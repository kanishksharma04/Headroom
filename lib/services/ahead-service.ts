import {
  groupByWeek,
  isDormant,
  projectCashFlow,
  summariseRecurringCommitments,
  type ProjectionHorizonDays,
  type ProjectionResult,
} from "@/lib/engines/ahead";
import { findAccountsByUserId } from "@/lib/repositories/account-repository";
import { findCommitmentsByUserId } from "@/lib/repositories/commitment-repository";
import type { Commitment } from "@/lib/generated/prisma/client";

export type AheadOverview = {
  projection: ProjectionResult;
  weeks: ReturnType<typeof groupByWeek>;
  recurringSummary: ReturnType<typeof summariseRecurringCommitments>;
  dormantCommitments: Commitment[];
};

export async function getAheadOverviewForUser(
  userId: string,
  now: Date,
  horizonDays: ProjectionHorizonDays,
): Promise<AheadOverview> {
  const [accounts, commitments] = await Promise.all([
    findAccountsByUserId(userId),
    findCommitmentsByUserId(userId, { activeOnly: true }),
  ]);

  const projection = projectCashFlow({
    now,
    horizonDays,
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    commitments,
  });

  return {
    projection,
    weeks: groupByWeek(projection.points),
    recurringSummary: summariseRecurringCommitments(commitments),
    dormantCommitments: commitments.filter((c) => isDormant(c, now)),
  };
}
