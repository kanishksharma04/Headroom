import {
  allocationByType,
  calculateNetWorth,
  splitNetWorthByOwnership,
  type AllocationEntry,
  type NetWorthOwnershipSplit,
  type NetWorthResult,
} from "@/lib/engines/networth";
import { findAccountsByUserId } from "@/lib/repositories/account-repository";
import { findAssetsByUserId } from "@/lib/repositories/asset-repository";
import { findLiabilitiesByUserId } from "@/lib/repositories/liability-repository";
import {
  getNetWorthAttributionForUser,
  getNetWorthCagrForUser,
  getNetWorthHistoryForUser,
  getYearOverYearAttributionForUser,
  type NetWorthAttributionResult,
  type NetWorthCagrResult,
  type NetWorthHistoryPoint,
} from "@/lib/services/networth-snapshot-service";
import type { Account, AssetType, Asset, Liability, LiabilityType } from "@/lib/generated/prisma/client";

export type WorthOverview = {
  netWorth: NetWorthResult;
  ownershipSplit: NetWorthOwnershipSplit;
  accounts: Account[];
  assets: Asset[];
  liabilities: Liability[];
  assetAllocation: AllocationEntry<AssetType>[];
  liabilityAllocation: AllocationEntry<LiabilityType>[];
  history: NetWorthHistoryPoint[];
  attribution: NetWorthAttributionResult | null;
  yearOverYear: NetWorthAttributionResult | null;
  cagr: NetWorthCagrResult | null;
};

export async function getWorthOverviewForUser(userId: string): Promise<WorthOverview> {
  const [accounts, assets, liabilities, history, attribution, yearOverYear, cagr] = await Promise.all([
    findAccountsByUserId(userId),
    findAssetsByUserId(userId),
    findLiabilitiesByUserId(userId),
    getNetWorthHistoryForUser(userId),
    getNetWorthAttributionForUser(userId),
    getYearOverYearAttributionForUser(userId),
    getNetWorthCagrForUser(userId),
  ]);

  const netWorth = calculateNetWorth({
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    assets: assets.map((a) => ({ currentValue: a.currentValue })),
    liabilities: liabilities.map((l) => ({ outstandingPrincipal: l.outstandingPrincipal })),
  });
  const ownershipSplit = splitNetWorthByOwnership({
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance, isJoint: a.isJoint })),
    assets: assets.map((a) => ({ currentValue: a.currentValue, isJoint: a.isJoint })),
    liabilities: liabilities.map((l) => ({
      outstandingPrincipal: l.outstandingPrincipal,
      isJoint: l.isJoint,
    })),
  });

  return {
    netWorth,
    ownershipSplit,
    accounts,
    assets,
    liabilities,
    assetAllocation: allocationByType(assets, (a) => a.currentValue),
    liabilityAllocation: allocationByType(liabilities, (l) => l.outstandingPrincipal),
    history,
    attribution,
    yearOverYear,
    cagr,
  };
}
