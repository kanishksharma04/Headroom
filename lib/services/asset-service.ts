import {
  createAsset,
  deleteAsset,
  findAssetById,
  findAssetsByUserId,
  updateAsset,
} from "@/lib/repositories/asset-repository";
import { NotFoundError } from "@/lib/services/account-service";
import { captureNetWorthSnapshotForUser } from "@/lib/services/networth-snapshot-service";
import type { AssetFormInput } from "@/lib/validation/asset";
import type { Asset } from "@/lib/generated/prisma/client";

export function listAssetsForUser(userId: string): Promise<Asset[]> {
  return findAssetsByUserId(userId);
}

export async function addAssetForUser(userId: string, input: AssetFormInput): Promise<Asset> {
  const asset = await createAsset({
    user: { connect: { id: userId } },
    name: input.name,
    type: input.type,
    investedAmount: input.investedAmount,
    currentValue: input.currentValue,
    valuationAsOf: input.valuationAsOf,
    expectedAnnualReturnPercent: input.expectedAnnualReturnPercent ?? null,
    isJoint: input.isJoint,
    notes: input.notes ?? null,
    amfiSchemeCode: input.amfiSchemeCode ?? null,
    unitsHeld: input.unitsHeld ?? null,
  });
  await captureNetWorthSnapshotForUser(userId, new Date());
  return asset;
}

async function requireOwnedAsset(userId: string, assetId: string): Promise<Asset> {
  const asset = await findAssetById(assetId);
  if (!asset || asset.userId !== userId) {
    throw new NotFoundError("Asset");
  }
  return asset;
}

export async function editAssetForUser(
  userId: string,
  assetId: string,
  input: AssetFormInput,
): Promise<Asset> {
  await requireOwnedAsset(userId, assetId);
  const asset = await updateAsset(assetId, {
    name: input.name,
    type: input.type,
    investedAmount: input.investedAmount,
    currentValue: input.currentValue,
    valuationAsOf: input.valuationAsOf,
    expectedAnnualReturnPercent: input.expectedAnnualReturnPercent ?? null,
    isJoint: input.isJoint,
    notes: input.notes ?? null,
    amfiSchemeCode: input.amfiSchemeCode ?? null,
    unitsHeld: input.unitsHeld ?? null,
    // The form is the source of truth for these fields; sync status is
    // exclusively written by the price-sync service and would otherwise go
    // stale the moment a scheme code or unit count changes here.
    lastPriceSyncAt: null,
    lastPriceSyncError: null,
  });
  await captureNetWorthSnapshotForUser(userId, new Date());
  return asset;
}

export async function removeAssetForUser(userId: string, assetId: string): Promise<void> {
  await requireOwnedAsset(userId, assetId);
  await deleteAsset(assetId);
  await captureNetWorthSnapshotForUser(userId, new Date());
}
