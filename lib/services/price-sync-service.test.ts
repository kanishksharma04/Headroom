import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { createAsset, findAssetById } from "@/lib/repositories/asset-repository";
import { NotFoundError } from "@/lib/services/account-service";
import { syncAllAssetPrices, syncAssetPriceForUser } from "@/lib/services/price-sync-service";
import { fetchLatestMfNav } from "@/lib/market-data/mf-nav-client";
import { istDate } from "@/lib/dates";

vi.mock("@/lib/market-data/mf-nav-client", () => ({
  fetchLatestMfNav: vi.fn(),
}));

describe("price-sync-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  afterEach(() => {
    vi.mocked(fetchLatestMfNav).mockReset();
  });

  async function makeUser() {
    const user = await createUser({
      email: `price-sync-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name: "Price Sync Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function makeSyncableAsset(userId: string, overrides: { unitsHeld?: string; schemeCode?: string } = {}) {
    return createAsset({
      user: { connect: { id: userId } },
      name: "Test Mutual Fund",
      type: "MUTUAL_FUND",
      investedAmount: "100000",
      currentValue: "100000",
      valuationAsOf: istDate(2026, 0, 1),
      isJoint: false,
      amfiSchemeCode: overrides.schemeCode ?? "119551",
      unitsHeld: overrides.unitsHeld ?? "1000",
    });
  }

  it("multiplies units held by the fetched NAV to compute the new current value", async () => {
    const user = await makeUser();
    const asset = await makeSyncableAsset(user.id, { unitsHeld: "1000" });
    vi.mocked(fetchLatestMfNav).mockResolvedValue({
      ok: true,
      navPerUnit: new Decimal("106.9164"),
      navDate: istDate(2026, 7, 24),
      schemeName: "Test Fund",
    });

    const result = await syncAssetPriceForUser(user.id, asset.id);

    expect(result).toEqual({ assetId: asset.id, ok: true });
    const reloaded = await findAssetById(asset.id);
    expect(reloaded?.currentValue.toString()).toBe("106916.4");
    expect(reloaded?.valuationAsOf.getTime()).toBe(istDate(2026, 7, 24).getTime());
    expect(reloaded?.lastPriceSyncError).toBeNull();
    expect(reloaded?.lastPriceSyncAt).not.toBeNull();
  });

  it("records the error and leaves currentValue untouched when the NAV lookup fails", async () => {
    const user = await makeUser();
    const asset = await makeSyncableAsset(user.id);
    vi.mocked(fetchLatestMfNav).mockResolvedValue({ ok: false, error: "No AMFI scheme found for code 119551." });

    const result = await syncAssetPriceForUser(user.id, asset.id);

    expect(result).toEqual({ assetId: asset.id, ok: false, error: "No AMFI scheme found for code 119551." });
    const reloaded = await findAssetById(asset.id);
    expect(reloaded?.currentValue.toString()).toBe(asset.currentValue.toString());
    expect(reloaded?.lastPriceSyncError).toBe("No AMFI scheme found for code 119551.");
    expect(reloaded?.lastPriceSyncAt).not.toBeNull();
  });

  it("refuses to sync another user's asset", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const asset = await makeSyncableAsset(owner.id);

    await expect(syncAssetPriceForUser(intruder.id, asset.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(fetchLatestMfNav).not.toHaveBeenCalled();
  });

  it("refuses to sync an asset that was never set up for sync", async () => {
    const user = await makeUser();
    const asset = await createAsset({
      user: { connect: { id: user.id } },
      name: "Plain FD",
      type: "FD",
      investedAmount: "50000",
      currentValue: "52000",
      valuationAsOf: istDate(2026, 0, 1),
      isJoint: false,
    });

    await expect(syncAssetPriceForUser(user.id, asset.id)).rejects.toThrow(
      "This asset isn't set up for price sync.",
    );
    expect(fetchLatestMfNav).not.toHaveBeenCalled();
  });

  it("syncs every sync-enabled asset and keeps going after one fails", async () => {
    const user = await makeUser();
    const good = await makeSyncableAsset(user.id, { schemeCode: "119551", unitsHeld: "10" });
    const bad = await makeSyncableAsset(user.id, { schemeCode: "000000", unitsHeld: "10" });
    vi.mocked(fetchLatestMfNav).mockImplementation(async (code: string) => {
      if (code === "119551") {
        return { ok: true, navPerUnit: new Decimal("50"), navDate: istDate(2026, 7, 24), schemeName: "Good Fund" };
      }
      return { ok: false, error: "No AMFI scheme found for code 000000." };
    });

    const results = await syncAllAssetPrices();

    expect(results.find((r) => r.assetId === good.id)).toEqual({ assetId: good.id, ok: true });
    expect(results.find((r) => r.assetId === bad.id)).toEqual({
      assetId: bad.id,
      ok: false,
      error: "No AMFI scheme found for code 000000.",
    });
  });

  it("never includes an asset with no scheme code in the all-assets sync", async () => {
    const user = await makeUser();
    const unsynced = await createAsset({
      user: { connect: { id: user.id } },
      name: "Not synced",
      type: "MUTUAL_FUND",
      investedAmount: "10000",
      currentValue: "10500",
      valuationAsOf: istDate(2026, 0, 1),
      isJoint: false,
    });
    vi.mocked(fetchLatestMfNav).mockResolvedValue({
      ok: true,
      navPerUnit: new Decimal("1"),
      navDate: istDate(2026, 7, 24),
      schemeName: "x",
    });

    const results = await syncAllAssetPrices();

    expect(results.find((r) => r.assetId === unsynced.id)).toBeUndefined();
  });
});
