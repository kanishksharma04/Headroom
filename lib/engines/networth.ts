import type Decimal from "decimal.js";
import { sum, toMoney, type Money } from "@/lib/money";

export type NetWorthInput = {
  accounts: { currentBalance: Decimal.Value }[];
  assets: { currentValue: Decimal.Value }[];
  liabilities: { outstandingPrincipal: Decimal.Value }[];
};

export type NetWorthResult = {
  totalAssets: Money;
  totalLiabilities: Money;
  netWorth: Money;
};

/** Total assets (liquid accounts + everything else), total liabilities, and the net worth they imply. */
export function calculateNetWorth(input: NetWorthInput): NetWorthResult {
  const totalAccounts = sum(input.accounts.map((a) => a.currentBalance));
  const totalAssetValue = sum(input.assets.map((a) => a.currentValue));
  const totalAssets = totalAccounts.plus(totalAssetValue);
  const totalLiabilities = sum(input.liabilities.map((l) => l.outstandingPrincipal));

  return { totalAssets, totalLiabilities, netWorth: totalAssets.minus(totalLiabilities) };
}

export type AllocationEntry<TType extends string> = {
  type: TType;
  value: Money;
  /** 0–100. Zero when the total is zero, rather than dividing by zero. */
  percentOfTotal: Money;
};

/** Groups items by their `type` field and computes each group's share of the total. */
export function allocationByType<TType extends string, TItem extends { type: TType }>(
  items: TItem[],
  getValue: (item: TItem) => Decimal.Value,
): AllocationEntry<TType>[] {
  const total = sum(items.map(getValue));
  const totals = new Map<TType, Money>();

  for (const item of items) {
    const existing = totals.get(item.type) ?? toMoney(0);
    totals.set(item.type, existing.plus(toMoney(getValue(item))));
  }

  return Array.from(totals.entries()).map(([type, value]) => ({
    type,
    value,
    percentOfTotal: total.isZero() ? toMoney(0) : value.div(total).times(100),
  }));
}

// ---------------------------------------------------------------------------
// Attribution — what changed a period's net worth, and why
// ---------------------------------------------------------------------------

export type AccountSnapshotItem = { id: string; currentBalance: Decimal.Value };
export type AssetSnapshotItem = {
  id: string;
  currentValue: Decimal.Value;
  investedAmount: Decimal.Value;
};
export type LiabilitySnapshotItem = { id: string; outstandingPrincipal: Decimal.Value };

export type NetWorthSnapshot = {
  accounts: AccountSnapshotItem[];
  assets: AssetSnapshotItem[];
  liabilities: LiabilitySnapshotItem[];
};

export type NetWorthAttribution = {
  totalChange: Money;
  /** Money the user put into (or withdrew from) an asset they already had, e.g. an extra SIP instalment. */
  contributions: Money;
  /** The part of an asset's value change not explained by a contribution — market movement. */
  marketMovement: Money;
  /** The part of a liability's change explained by paying down principal (positive when the balance fell). */
  principalRepaid: Money;
  /** Everything else: account balance movement, and any account, asset or liability added or removed between snapshots. */
  other: Money;
};

function netWorthOfSnapshot(snapshot: NetWorthSnapshot): Money {
  return calculateNetWorth({
    accounts: snapshot.accounts,
    assets: snapshot.assets,
    liabilities: snapshot.liabilities,
  }).netWorth;
}

/**
 * Decomposes the net worth change between two snapshots into why it
 * happened. Items are matched by id across snapshots.
 *
 * A newly added or removed asset/liability is attributed entirely to
 * `other`, not to `contributions` or `marketMovement` — a record appearing
 * for the first time usually represents backfilled history (the user
 * entering a holding they've had for years), not this period's activity.
 * Account balances are always `other`: without transaction-level data,
 * a balance change can't be honestly split into contribution vs. movement.
 *
 * `contributions + marketMovement + principalRepaid + other` always equals
 * `totalChange` exactly — every rupee of change is assigned to one bucket.
 */
export function attributeNetWorthChange(
  previous: NetWorthSnapshot,
  current: NetWorthSnapshot,
): NetWorthAttribution {
  let contributions = toMoney(0);
  let marketMovement = toMoney(0);
  let principalRepaid = toMoney(0);
  let other = toMoney(0);

  const previousAssetsById = new Map(previous.assets.map((a) => [a.id, a]));
  const currentAssetIds = new Set(current.assets.map((a) => a.id));
  for (const asset of current.assets) {
    const prev = previousAssetsById.get(asset.id);
    if (!prev) {
      other = other.plus(toMoney(asset.currentValue));
      continue;
    }
    const investedDelta = toMoney(asset.investedAmount).minus(toMoney(prev.investedAmount));
    const valueDelta = toMoney(asset.currentValue).minus(toMoney(prev.currentValue));
    contributions = contributions.plus(investedDelta);
    marketMovement = marketMovement.plus(valueDelta.minus(investedDelta));
  }
  for (const prev of previous.assets) {
    if (!currentAssetIds.has(prev.id)) {
      other = other.minus(toMoney(prev.currentValue));
    }
  }

  const previousLiabilitiesById = new Map(previous.liabilities.map((l) => [l.id, l]));
  const currentLiabilityIds = new Set(current.liabilities.map((l) => l.id));
  for (const liability of current.liabilities) {
    const prev = previousLiabilitiesById.get(liability.id);
    if (!prev) {
      other = other.minus(toMoney(liability.outstandingPrincipal));
      continue;
    }
    const repaid = toMoney(prev.outstandingPrincipal).minus(toMoney(liability.outstandingPrincipal));
    principalRepaid = principalRepaid.plus(repaid);
  }
  for (const prev of previous.liabilities) {
    if (!currentLiabilityIds.has(prev.id)) {
      other = other.plus(toMoney(prev.outstandingPrincipal));
    }
  }

  const previousAccountsById = new Map(previous.accounts.map((a) => [a.id, a]));
  const currentAccountIds = new Set(current.accounts.map((a) => a.id));
  for (const account of current.accounts) {
    const prevBalance = previousAccountsById.get(account.id)?.currentBalance ?? 0;
    other = other.plus(toMoney(account.currentBalance).minus(toMoney(prevBalance)));
  }
  for (const prev of previous.accounts) {
    if (!currentAccountIds.has(prev.id)) {
      other = other.minus(toMoney(prev.currentBalance));
    }
  }

  const totalChange = netWorthOfSnapshot(current).minus(netWorthOfSnapshot(previous));

  return { totalChange, contributions, marketMovement, principalRepaid, other };
}
