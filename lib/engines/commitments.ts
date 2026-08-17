import type Decimal from "decimal.js";
import { toMoney, type Money } from "@/lib/money";
import { addMonthsClamped, getIstParts, resolveIstDateForDayOfMonth } from "@/lib/dates";

export type CommitmentDirection = "INFLOW" | "OUTFLOW";
export type CommitmentFrequency = "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL";

export type CommitmentForOccurrences = {
  id: string;
  name: string;
  direction: CommitmentDirection;
  amount: Decimal.Value;
  frequency: CommitmentFrequency;
  anchorDate: Date;
  dayOfMonth?: number | null;
  endDate?: Date | null;
  isActive: boolean;
};

export type CommitmentOccurrence = {
  commitmentId: string;
  name: string;
  direction: CommitmentDirection;
  amount: Money;
  date: Date;
};

const RECURRING_STEP_MONTHS: Record<Exclude<CommitmentFrequency, "ONE_TIME">, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  ANNUAL: 12,
};

/** A generous cap on iterations, purely defensive — real windows resolve in a handful of steps. */
const MAX_OCCURRENCES = 10_000;

function withinRange(date: Date, from: Date, to: Date): boolean {
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

/**
 * Generates every occurrence of a commitment falling within `[window.from,
 * window.to]` (inclusive). Handles month-end resolution — a commitment
 * anchored on the 31st correctly falls on the 28th/29th in February — and
 * respects `endDate` and `isActive`.
 */
export function generateOccurrences(
  commitment: CommitmentForOccurrences,
  window: { from: Date; to: Date },
): CommitmentOccurrence[] {
  if (!commitment.isActive) {
    return [];
  }

  const amount = toMoney(commitment.amount);
  const toOccurrence = (date: Date): CommitmentOccurrence => ({
    commitmentId: commitment.id,
    name: commitment.name,
    direction: commitment.direction,
    amount,
    date,
  });

  if (commitment.frequency === "ONE_TIME") {
    const withinEnd = !commitment.endDate || commitment.anchorDate.getTime() <= commitment.endDate.getTime();
    if (withinEnd && withinRange(commitment.anchorDate, window.from, window.to)) {
      return [toOccurrence(commitment.anchorDate)];
    }
    return [];
  }

  const stepMonths = RECURRING_STEP_MONTHS[commitment.frequency];
  const anchorParts = getIstParts(commitment.anchorDate);
  const dayOfMonth = commitment.dayOfMonth ?? anchorParts.day;
  const anchorMonthIndex = anchorParts.year * 12 + anchorParts.month;

  const fromParts = getIstParts(window.from);
  const fromMonthIndex = fromParts.year * 12 + fromParts.month;

  // Jump close to the window's start rather than walking from the anchor
  // one step at a time when the anchor is years in the past.
  let stepIndex = Math.max(0, Math.floor((fromMonthIndex - anchorMonthIndex) / stepMonths));

  const occurrences: CommitmentOccurrence[] = [];
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    const monthIndex = anchorMonthIndex + stepIndex * stepMonths;
    const year = Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;
    const date = resolveIstDateForDayOfMonth(year, month, dayOfMonth);

    if (date.getTime() < commitment.anchorDate.getTime()) {
      // Clamping can occasionally land a step before the anchor itself
      // (e.g. a large negative jump was clamped to 0) — skip forward.
      stepIndex++;
      continue;
    }
    if (date.getTime() > window.to.getTime()) {
      break;
    }
    if (commitment.endDate && date.getTime() > commitment.endDate.getTime()) {
      break;
    }
    if (date.getTime() >= window.from.getTime()) {
      occurrences.push(toOccurrence(date));
    }
    stepIndex++;
  }

  return occurrences;
}

// ---------------------------------------------------------------------------
// EMI commitments — derived from a liability, never entered twice
// ---------------------------------------------------------------------------

export type EmiCommitmentFields = {
  amount: Money;
  anchorDate: Date;
  dayOfMonth: number;
  endDate: Date;
};

/**
 * Derives the fields for the Commitment record that mirrors a liability's
 * EMI, so it never has to be entered separately. The first instalment
 * lands on `emiDayOfMonth` in the loan's start month; the commitment ends
 * with the loan's original final instalment.
 */
export function deriveEmiCommitmentFields(liability: {
  emiAmount: Decimal.Value;
  emiDayOfMonth: number;
  startDate: Date;
  tenureMonths: number;
}): EmiCommitmentFields {
  const { year, month } = getIstParts(liability.startDate);
  const anchorDate = resolveIstDateForDayOfMonth(year, month, liability.emiDayOfMonth);
  const endDate = addMonthsClamped(anchorDate, liability.tenureMonths - 1);

  return {
    amount: toMoney(liability.emiAmount),
    anchorDate,
    dayOfMonth: liability.emiDayOfMonth,
    endDate,
  };
}
