import type Decimal from "decimal.js";
import { max, min, sum, toMoney, type Money } from "@/lib/money";
import { getIstParts } from "@/lib/dates";

const GOAL_PROJECTION_MAX_MONTHS = 1200;

/** Below this fraction of the inflation-adjusted target, a goal is off track rather than merely at risk. */
const AT_RISK_THRESHOLD_PERCENT = 90;

export type GoalStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";

export type GoalInput = {
  currentAmount: Decimal.Value;
  targetAmount: Decimal.Value;
  monthlyContribution: Decimal.Value;
  expectedAnnualReturnPercent: Decimal.Value;
  inflationPercent: Decimal.Value;
  targetDate: Date;
};

export type GoalProjection = {
  monthsRemaining: number;
  /** The target amount restated in the rupees you'll actually be spending at `targetDate`. */
  inflationAdjustedTarget: Money;
  /** What your current pace (existing balance + contributions, compounding) gets you to by `targetDate`. */
  projectedAmount: Money;
  /** Zero if `projectedAmount` already clears the inflation-adjusted target. */
  shortfallAtTargetDate: Money;
  /** The monthly contribution that would exactly clear the inflation-adjusted target by `targetDate`. */
  requiredMonthlyContribution: Money;
  /** Months of contributions, at the goal's own pace, until the inflation-adjusted target is reached — null if that's beyond 100 years. */
  monthsToReachTarget: number | null;
  status: GoalStatus;
  /** projectedAmount as a percentage of the inflation-adjusted target, clamped to [0, 100] — for a progress bar. */
  progressPercent: Money;
};

/** Whole calendar months from `now` to `targetDate`, floored, never negative. */
export function monthsUntil(now: Date, targetDate: Date): number {
  const from = getIstParts(now);
  const to = getIstParts(targetDate);
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day) {
    months -= 1;
  }
  return Math.max(months, 0);
}

/**
 * Future value of a starting balance plus a fixed monthly contribution,
 * compounding monthly — the closed-form solution to the same
 * balance = balance*(1+r) + contribution recursion used elsewhere in this
 * engine, so a projected amount and a month-by-month walk of the same
 * inputs always agree.
 */
export function projectGoalAmount(
  currentAmount: Decimal.Value,
  monthlyContribution: Decimal.Value,
  annualReturnPercent: Decimal.Value,
  months: number,
): Money {
  const principal = toMoney(currentAmount);
  const contribution = toMoney(monthlyContribution);
  const monthlyRate = toMoney(annualReturnPercent).div(12).div(100);

  if (months <= 0) {
    return principal;
  }
  if (monthlyRate.isZero()) {
    return principal.plus(contribution.times(months));
  }

  const growthFactor = monthlyRate.plus(1).pow(months);
  const futureValueOfPrincipal = principal.times(growthFactor);
  const futureValueOfContributions = contribution.times(growthFactor.minus(1)).div(monthlyRate);
  return futureValueOfPrincipal.plus(futureValueOfContributions);
}

/**
 * The monthly contribution that carries `currentAmount` to exactly
 * `targetAmount` over `months`, at `annualReturnPercent` — the inverse of
 * {@link projectGoalAmount}. Returns 0 if the target is already met or
 * `months` is zero or negative (nothing left to contribute).
 */
export function requiredMonthlyContribution(
  currentAmount: Decimal.Value,
  targetAmount: Decimal.Value,
  annualReturnPercent: Decimal.Value,
  months: number,
): Money {
  const principal = toMoney(currentAmount);
  const target = toMoney(targetAmount);
  const monthlyRate = toMoney(annualReturnPercent).div(12).div(100);

  if (months <= 0) {
    return max(target.minus(principal), 0);
  }

  if (monthlyRate.isZero()) {
    return max(target.minus(principal), 0).div(months);
  }

  const growthFactor = monthlyRate.plus(1).pow(months);
  const futureValueOfPrincipal = principal.times(growthFactor);
  const remaining = target.minus(futureValueOfPrincipal);
  if (remaining.lessThanOrEqualTo(0)) {
    return toMoney(0);
  }
  return remaining.times(monthlyRate).div(growthFactor.minus(1));
}

/**
 * Months of monthly contributions (compounding at the given rate) until
 * `currentAmount` reaches `targetAmount`, or null if that's more than 100
 * years out. Walked month by month rather than solved in closed form,
 * since — unlike a fixed-horizon projection — the number of months is
 * exactly what's being solved for.
 */
export function monthsToReachTarget(
  currentAmount: Decimal.Value,
  targetAmount: Decimal.Value,
  monthlyContribution: Decimal.Value,
  annualReturnPercent: Decimal.Value,
): number | null {
  const target = toMoney(targetAmount);
  let balance = toMoney(currentAmount);
  if (balance.gte(target)) {
    return 0;
  }
  const monthlyRate = toMoney(annualReturnPercent).div(12).div(100);
  const contribution = toMoney(monthlyContribution);

  for (let month = 1; month <= GOAL_PROJECTION_MAX_MONTHS; month++) {
    balance = balance.times(monthlyRate.plus(1)).plus(contribution);
    if (balance.gte(target)) {
      return month;
    }
  }
  return null;
}

function resolveStatus(projectedAmount: Money, inflationAdjustedTarget: Money): GoalStatus {
  if (inflationAdjustedTarget.lessThanOrEqualTo(0) || projectedAmount.gte(inflationAdjustedTarget)) {
    return "ON_TRACK";
  }
  const atRiskFloor = inflationAdjustedTarget.times(AT_RISK_THRESHOLD_PERCENT).div(100);
  return projectedAmount.gte(atRiskFloor) ? "AT_RISK" : "OFF_TRACK";
}

/**
 * Evaluates a goal as of `now`: what its target is worth in future rupees,
 * what your current pace actually gets you to, and what it would take to
 * close any gap. Every figure here is traceable back to a plain compounding
 * formula — nothing here is a health score or a rating, just arithmetic on
 * the goal's own numbers.
 */
export function evaluateGoal(input: GoalInput, now: Date): GoalProjection {
  const monthsRemaining = monthsUntil(now, input.targetDate);

  const inflationRate = toMoney(input.inflationPercent).div(100);
  const yearsRemaining = toMoney(monthsRemaining).div(12);
  const inflationAdjustedTarget = toMoney(input.targetAmount).times(
    inflationRate.plus(1).pow(yearsRemaining),
  );

  const projectedAmount = projectGoalAmount(
    input.currentAmount,
    input.monthlyContribution,
    input.expectedAnnualReturnPercent,
    monthsRemaining,
  );

  const shortfallAtTargetDate = max(inflationAdjustedTarget.minus(projectedAmount), 0);

  const requiredContribution = requiredMonthlyContribution(
    input.currentAmount,
    inflationAdjustedTarget,
    input.expectedAnnualReturnPercent,
    monthsRemaining,
  );

  const monthsToTarget = monthsToReachTarget(
    input.currentAmount,
    inflationAdjustedTarget,
    input.monthlyContribution,
    input.expectedAnnualReturnPercent,
  );

  const progressPercent = inflationAdjustedTarget.lessThanOrEqualTo(0)
    ? toMoney(100)
    : min(100, max(projectedAmount.div(inflationAdjustedTarget).times(100), 0));

  return {
    monthsRemaining,
    inflationAdjustedTarget,
    projectedAmount,
    shortfallAtTargetDate,
    requiredMonthlyContribution: requiredContribution,
    monthsToReachTarget: monthsToTarget,
    status: resolveStatus(projectedAmount, inflationAdjustedTarget),
    progressPercent,
  };
}

export function summariseGoals(projections: { targetAmount: Decimal.Value; projection: GoalProjection }[]): {
  totalTarget: Money;
  totalProjected: Money;
  onTrackCount: number;
} {
  return {
    totalTarget: sum(projections.map((p) => p.targetAmount)),
    totalProjected: sum(projections.map((p) => p.projection.projectedAmount)),
    onTrackCount: projections.filter((p) => p.projection.status === "ON_TRACK").length,
  };
}
