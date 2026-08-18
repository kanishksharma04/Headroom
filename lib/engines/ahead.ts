import type Decimal from "decimal.js";
import { addDays } from "date-fns";
import { sum, toMoney, type Money } from "@/lib/money";
import { getIstDayOfWeek } from "@/lib/dates";
import {
  generateOccurrences,
  type CommitmentDirection,
  type CommitmentForOccurrences,
  type CommitmentFrequency,
} from "@/lib/engines/commitments";

export type ProjectionHorizonDays = 30 | 60 | 90;

export type ProjectionPoint = {
  date: Date;
  label: string;
  amount: Money; // signed: positive for inflows, negative for outflows
  direction: CommitmentDirection;
  sourceId: string;
  /** The account/commitment total immediately after this point is applied. */
  runningBalance: Money;
};

export type ProjectionResult = {
  horizonDays: ProjectionHorizonDays;
  from: Date;
  to: Date;
  startBalance: Money;
  points: ProjectionPoint[];
  endBalance: Money;
  goesNegative: boolean;
  firstNegativeDate: Date | null;
};

function signedAmount(direction: CommitmentDirection, amount: Money): Money {
  return direction === "OUTFLOW" ? amount.negated() : amount;
}

/**
 * Projects the running account balance across a fixed 30/60/90-day
 * horizon, applying every commitment occurrence — including salary,
 * unlike the Headroom engine, which deliberately excludes the salary
 * occurrence that defines its window. Here there's no such boundary:
 * the horizon is fixed, so every inflow and outflow is shown as it lands.
 */
export function projectCashFlow(input: {
  now: Date;
  horizonDays: ProjectionHorizonDays;
  accounts: { currentBalance: Decimal.Value }[];
  commitments: CommitmentForOccurrences[];
}): ProjectionResult {
  const { now, horizonDays, accounts, commitments } = input;
  const from = now;
  const to = addDays(now, horizonDays);
  const startBalance = sum(accounts.map((a) => a.currentBalance));

  const occurrences = commitments.flatMap((commitment) =>
    generateOccurrences(commitment, { from, to }).map((occurrence) => ({
      commitment,
      occurrence,
    })),
  );
  occurrences.sort((a, b) => a.occurrence.date.getTime() - b.occurrence.date.getTime());

  let running = startBalance;
  let firstNegativeDate: Date | null = null;
  const points: ProjectionPoint[] = occurrences.map(({ commitment, occurrence }) => {
    const amount = signedAmount(commitment.direction, occurrence.amount);
    running = running.plus(amount);
    if (running.isNegative() && !firstNegativeDate) {
      firstNegativeDate = occurrence.date;
    }
    return {
      date: occurrence.date,
      label: commitment.name,
      amount,
      direction: commitment.direction,
      sourceId: commitment.id,
      runningBalance: running,
    };
  });

  return {
    horizonDays,
    from,
    to,
    startBalance,
    points,
    endBalance: running,
    goesNegative: firstNegativeDate !== null,
    firstNegativeDate,
  };
}

/** Groups projection points into calendar-week buckets, in chronological order. */
export function groupByWeek(points: ProjectionPoint[]): { weekStart: Date; points: ProjectionPoint[] }[] {
  const groups = new Map<number, ProjectionPoint[]>();
  for (const point of points) {
    const weekStart = startOfIstWeek(point.date);
    const key = weekStart.getTime();
    const list = groups.get(key) ?? [];
    list.push(point);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, list]) => ({ weekStart: new Date(key), points: list }));
}

function startOfIstWeek(date: Date): Date {
  // Monday-start week.
  const day = getIstDayOfWeek(date);
  const diffToMonday = (day + 6) % 7;
  return addDays(date, -diffToMonday);
}

// ---------------------------------------------------------------------------
// Recurring commitment summary
// ---------------------------------------------------------------------------

const OCCURRENCES_PER_YEAR: Record<Exclude<CommitmentFrequency, "ONE_TIME">, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  HALF_YEARLY: 2,
  ANNUAL: 1,
};

const APPROXIMATE_CYCLE_DAYS: Record<Exclude<CommitmentFrequency, "ONE_TIME">, number> = {
  MONTHLY: 30,
  QUARTERLY: 91,
  HALF_YEARLY: 182,
  ANNUAL: 365,
};

export type RecurringCommitmentSummary = {
  monthlyOutflowTotal: Money;
  annualOutflowTotal: Money;
};

/** Summarises the steady-state recurring load: what a typical month and year cost, from OUTFLOW commitments alone. */
export function summariseRecurringCommitments(
  commitments: (CommitmentForOccurrences & { frequency: CommitmentFrequency })[],
): RecurringCommitmentSummary {
  const recurring = commitments.filter(
    (c): c is typeof c & { frequency: Exclude<CommitmentFrequency, "ONE_TIME"> } =>
      c.isActive && c.direction === "OUTFLOW" && c.frequency !== "ONE_TIME",
  );

  const annualOutflowTotal = sum(
    recurring.map((c) => toMoney(c.amount).times(OCCURRENCES_PER_YEAR[c.frequency])),
  );
  const monthlyOutflowTotal = annualOutflowTotal.div(12);

  return { monthlyOutflowTotal, annualOutflowTotal };
}

/**
 * A commitment is dormant if it hasn't been updated in at least three of
 * its own cycles — the only "is this still real" signal available without
 * transaction history or a mark-as-paid action.
 */
export function isDormant(
  commitment: { frequency: CommitmentFrequency; updatedAt: Date; isActive: boolean },
  now: Date,
): boolean {
  if (!commitment.isActive || commitment.frequency === "ONE_TIME") {
    return false;
  }
  const cycleDays = APPROXIMATE_CYCLE_DAYS[commitment.frequency];
  const daysSinceUpdate = (now.getTime() - commitment.updatedAt.getTime()) / (24 * 60 * 60 * 1000);
  return daysSinceUpdate >= cycleDays * 3;
}
