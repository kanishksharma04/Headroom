import { calculateHeadroom, type HeadroomResult } from "@/lib/engines/headroom";
import {
  detectAttentionItems,
  type AttentionItem,
  type StaleBalanceSource,
} from "@/lib/engines/attention";
import { calculateNetWorth, type NetWorthResult } from "@/lib/engines/networth";
import { findAccountsByUserId } from "@/lib/repositories/account-repository";
import { findAssetsByUserId } from "@/lib/repositories/asset-repository";
import { findLiabilitiesByUserId } from "@/lib/repositories/liability-repository";
import { findCommitmentsByUserId } from "@/lib/repositories/commitment-repository";
import { findVariableSpendBaselineByUserId } from "@/lib/repositories/variable-spend-baseline-repository";
import type { Commitment } from "@/lib/generated/prisma/client";

export type TodayOverview = {
  headroom: HeadroomResult;
  netWorth: NetWorthResult;
  upcomingCommitments: Array<{
    id: string;
    label: string;
    amount: HeadroomResult["lines"][number]["amount"];
    date: Date;
  }>;
  attentionItems: AttentionItem[];
};

function toHeadroomCommitmentInput(commitment: Commitment) {
  return {
    id: commitment.id,
    name: commitment.name,
    direction: commitment.direction,
    category: commitment.category,
    amount: commitment.amount,
    frequency: commitment.frequency,
    anchorDate: commitment.anchorDate,
    dayOfMonth: commitment.dayOfMonth,
    endDate: commitment.endDate,
    isActive: commitment.isActive,
    isVariable: commitment.isVariable,
  };
}

/** Assembles everything the Today screen needs in one pass over the user's data. */
export async function getTodayOverviewForUser(userId: string, now: Date): Promise<TodayOverview> {
  const [accounts, assets, liabilities, commitments, variableSpend] = await Promise.all([
    findAccountsByUserId(userId),
    findAssetsByUserId(userId),
    findLiabilitiesByUserId(userId),
    findCommitmentsByUserId(userId, { activeOnly: true }),
    findVariableSpendBaselineByUserId(userId),
  ]);

  const headroom = calculateHeadroom({
    now,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, currentBalance: a.currentBalance })),
    commitments: commitments.map(toHeadroomCommitmentInput),
    variableSpendBaseline: variableSpend ? { monthlyAmount: variableSpend.monthlyAmount } : null,
  });

  const netWorth = calculateNetWorth({
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    assets: assets.map((a) => ({ currentValue: a.currentValue })),
    liabilities: liabilities.map((l) => ({ outstandingPrincipal: l.outstandingPrincipal })),
  });

  const upcomingCommitments = headroom.lines
    .filter((line): line is typeof line & { date: Date } => line.date !== null && line.kind !== "BALANCE")
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3)
    .map((line) => ({
      id: line.sourceId ?? line.label,
      label: line.label,
      amount: line.amount,
      date: line.date,
    }));

  const staleBalanceSources: StaleBalanceSource[] = [
    ...accounts.map((a) => ({ id: a.id, name: a.name, kind: "ACCOUNT" as const, asOf: a.balanceAsOf })),
    ...assets.map((a) => ({ id: a.id, name: a.name, kind: "ASSET" as const, asOf: a.valuationAsOf })),
  ];

  const attentionItems = detectAttentionItems(
    headroom,
    liabilities.map((l) => ({
      id: l.id,
      name: l.name,
      emiDayOfMonth: l.emiDayOfMonth,
      outstandingAsOf: l.outstandingAsOf,
    })),
    now,
    staleBalanceSources,
  );

  return { headroom, netWorth, upcomingCommitments, attentionItems };
}
