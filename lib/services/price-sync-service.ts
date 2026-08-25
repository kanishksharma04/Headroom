import {
  findAssetById,
  findAssetsWithPriceSyncEnabled,
  updateAsset,
} from "@/lib/repositories/asset-repository";
import { NotFoundError } from "@/lib/services/account-service";
import { captureNetWorthSnapshotForUser } from "@/lib/services/networth-snapshot-service";
import { fetchLatestMfNav } from "@/lib/market-data/mf-nav-client";
import { multiply } from "@/lib/money";
import type { Asset } from "@/lib/generated/prisma/client";

export type PriceSyncResult = { assetId: string; ok: boolean; error?: string };

/**
 * Fetches the asset's latest NAV and applies it, whatever the outcome —
 * `currentValue`/`valuationAsOf` only move on success, but
 * `lastPriceSyncAt` always advances to "now" so the UI can show when sync
 * was last attempted, not just when it last worked.
 */
async function applySync(asset: Asset): Promise<PriceSyncResult> {
  const schemeCode = asset.amfiSchemeCode;
  const unitsHeld = asset.unitsHeld;
  if (!schemeCode || !unitsHeld) {
    throw new Error("This asset isn't set up for price sync.");
  }

  const lookup = await fetchLatestMfNav(schemeCode);
  if (!lookup.ok) {
    await updateAsset(asset.id, { lastPriceSyncAt: new Date(), lastPriceSyncError: lookup.error });
    return { assetId: asset.id, ok: false, error: lookup.error };
  }

  await updateAsset(asset.id, {
    currentValue: multiply(unitsHeld, lookup.navPerUnit),
    valuationAsOf: lookup.navDate,
    lastPriceSyncAt: new Date(),
    lastPriceSyncError: null,
  });
  await captureNetWorthSnapshotForUser(asset.userId, new Date());
  return { assetId: asset.id, ok: true };
}

/** Syncs one asset on demand — e.g. a user clicking "Sync now" on Worth. */
export async function syncAssetPriceForUser(userId: string, assetId: string): Promise<PriceSyncResult> {
  const asset = await findAssetById(assetId);
  if (!asset || asset.userId !== userId) {
    throw new NotFoundError("Asset");
  }
  if (!asset.amfiSchemeCode || !asset.unitsHeld) {
    throw new Error("This asset isn't set up for price sync.");
  }
  return applySync(asset);
}

/**
 * Syncs every sync-enabled asset across every user — meant to be called
 * once a day from the cron route. Sequential, out of courtesy to the
 * underlying free public API rather than hammering it with a burst of
 * concurrent requests; one asset's failure (bad scheme code, source
 * hiccup) is recorded on that asset and never stops the rest of the run.
 */
export async function syncAllAssetPrices(): Promise<PriceSyncResult[]> {
  const assets = await findAssetsWithPriceSyncEnabled();
  const results: PriceSyncResult[] = [];
  for (const asset of assets) {
    results.push(await applySync(asset));
  }
  return results;
}
