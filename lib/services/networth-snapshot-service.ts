import { addDays } from "date-fns";
import {
  calculateCagr,
  calculateNetWorth,
  attributeNetWorthChange,
  type CagrResult,
  type NetWorthAttribution,
} from "@/lib/engines/networth";
import { toMoney, type Money } from "@/lib/money";
import { startOfIstDay } from "@/lib/dates";
import { findAccountsByUserId } from "@/lib/repositories/account-repository";
import { findAssetsByUserId } from "@/lib/repositories/asset-repository";
import { findLiabilitiesByUserId } from "@/lib/repositories/liability-repository";
import {
  findNetWorthSnapshotsByUserId,
  upsertNetWorthSnapshot,
} from "@/lib/repositories/networth-snapshot-repository";
import type { NetWorthSnapshot as NetWorthSnapshotRecord } from "@/lib/generated/prisma/client";

type SnapshotAccount = { id: string; currentBalance: string };
type SnapshotAsset = { id: string; currentValue: string; investedAmount: string };
type SnapshotLiability = { id: string; outstandingPrincipal: string };

/**
 * Captures today's full balance sheet as a snapshot, upserted so repeated
 * calls the same IST day just update that day's row. Called after every
 * account/asset/liability mutation — this is the only source of history
 * V0 has, so it must never be skipped on a write path.
 */
export async function captureNetWorthSnapshotForUser(userId: string, now: Date): Promise<void> {
  const [accounts, assets, liabilities] = await Promise.all([
    findAccountsByUserId(userId),
    findAssetsByUserId(userId),
    findLiabilitiesByUserId(userId),
  ]);

  const netWorth = calculateNetWorth({
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    assets: assets.map((a) => ({ currentValue: a.currentValue })),
    liabilities: liabilities.map((l) => ({ outstandingPrincipal: l.outstandingPrincipal })),
  });

  await upsertNetWorthSnapshot(userId, startOfIstDay(now), {
    netWorth: netWorth.netWorth.toFixed(4),
    totalAssets: netWorth.totalAssets.toFixed(4),
    totalLiabilities: netWorth.totalLiabilities.toFixed(4),
    accountsJson: accounts.map(
      (a): SnapshotAccount => ({ id: a.id, currentBalance: a.currentBalance.toFixed(4) }),
    ),
    assetsJson: assets.map(
      (a): SnapshotAsset => ({
        id: a.id,
        currentValue: a.currentValue.toFixed(4),
        investedAmount: a.investedAmount.toFixed(4),
      }),
    ),
    liabilitiesJson: liabilities.map(
      (l): SnapshotLiability => ({ id: l.id, outstandingPrincipal: l.outstandingPrincipal.toFixed(4) }),
    ),
  });
}

export type NetWorthHistoryPoint = {
  date: Date;
  netWorth: Money;
  totalAssets: Money;
  totalLiabilities: Money;
};

export async function getNetWorthHistoryForUser(userId: string): Promise<NetWorthHistoryPoint[]> {
  const snapshots = await findNetWorthSnapshotsByUserId(userId);
  return snapshots.map((s) => ({
    date: s.capturedAt,
    netWorth: toMoney(s.netWorth),
    totalAssets: toMoney(s.totalAssets),
    totalLiabilities: toMoney(s.totalLiabilities),
  }));
}

function snapshotToEngineInput(snapshot: NetWorthSnapshotRecord) {
  return {
    accounts: snapshot.accountsJson as SnapshotAccount[],
    assets: snapshot.assetsJson as SnapshotAsset[],
    liabilities: snapshot.liabilitiesJson as SnapshotLiability[],
  };
}

export type NetWorthAttributionResult = NetWorthAttribution & {
  fromDate: Date;
  toDate: Date;
};

/** The latest snapshot on or before `daysBack` days before `latest` — the closest thing to "exactly N days ago" the recorded history has. */
function findComparisonSnapshot(
  snapshots: NetWorthSnapshotRecord[],
  latest: NetWorthSnapshotRecord,
  daysBack: number,
): NetWorthSnapshotRecord | null {
  const targetDate = addDays(latest.capturedAt, -daysBack);

  let comparison: NetWorthSnapshotRecord | null = null;
  for (const snapshot of snapshots) {
    if (snapshot.capturedAt.getTime() <= targetDate.getTime()) {
      comparison = snapshot;
    } else {
      break;
    }
  }

  if (!comparison || comparison.id === latest.id) {
    return null;
  }
  return comparison;
}

const MONTH_LOOKBACK_DAYS = 30;
const YEAR_LOOKBACK_DAYS = 365;

/**
 * Compares the latest snapshot against the closest one at least ~30 days
 * older, decomposing what changed. Returns null when there isn't enough
 * history yet — an honest "come back later" rather than a fabricated
 * comparison against too little data.
 */
export async function getNetWorthAttributionForUser(
  userId: string,
): Promise<NetWorthAttributionResult | null> {
  const snapshots = await findNetWorthSnapshotsByUserId(userId);
  if (snapshots.length < 2) {
    return null;
  }

  const latest = snapshots[snapshots.length - 1];
  const comparison = findComparisonSnapshot(snapshots, latest, MONTH_LOOKBACK_DAYS);
  if (!comparison) {
    return null;
  }

  const attribution = attributeNetWorthChange(
    snapshotToEngineInput(comparison),
    snapshotToEngineInput(latest),
  );

  return { ...attribution, fromDate: comparison.capturedAt, toDate: latest.capturedAt };
}

/**
 * The same decomposition as {@link getNetWorthAttributionForUser}, but
 * against the closest snapshot at least ~365 days back — "what changed
 * this year and why" instead of this month. Returns null under a year of
 * history in.
 */
export async function getYearOverYearAttributionForUser(
  userId: string,
): Promise<NetWorthAttributionResult | null> {
  const snapshots = await findNetWorthSnapshotsByUserId(userId);
  if (snapshots.length < 2) {
    return null;
  }

  const latest = snapshots[snapshots.length - 1];
  const comparison = findComparisonSnapshot(snapshots, latest, YEAR_LOOKBACK_DAYS);
  if (!comparison) {
    return null;
  }

  const attribution = attributeNetWorthChange(
    snapshotToEngineInput(comparison),
    snapshotToEngineInput(latest),
  );

  return { ...attribution, fromDate: comparison.capturedAt, toDate: latest.capturedAt };
}

export type NetWorthCagrResult = CagrResult & { fromDate: Date; toDate: Date };

/** Requires at least this much recorded history before CAGR is shown at all — annualising a short window produces a wild, meaningless percentage even though the maths is technically valid. */
const MIN_CAGR_SPAN_DAYS = 180;

/**
 * Compound annual growth rate from the very first recorded snapshot to
 * the latest. Returns null under {@link MIN_CAGR_SPAN_DAYS} of history, or
 * when {@link calculateCagr} itself can't produce a meaningful figure (a
 * net worth that started at or dipped to zero or below).
 */
export async function getNetWorthCagrForUser(userId: string): Promise<NetWorthCagrResult | null> {
  const snapshots = await findNetWorthSnapshotsByUserId(userId);
  if (snapshots.length < 2) {
    return null;
  }

  const earliest = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const spanDays = (latest.capturedAt.getTime() - earliest.capturedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays < MIN_CAGR_SPAN_DAYS) {
    return null;
  }

  const cagr = calculateCagr(earliest.netWorth, earliest.capturedAt, latest.netWorth, latest.capturedAt);
  if (!cagr) {
    return null;
  }

  return { ...cagr, fromDate: earliest.capturedAt, toDate: latest.capturedAt };
}
