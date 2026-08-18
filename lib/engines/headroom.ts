import type Decimal from "decimal.js";
import { addDays } from "date-fns";
import { toMoney, type Money } from "@/lib/money";
import { daysInMonth, getIstParts, startOfIstDay } from "@/lib/dates";
import {
  generateOccurrences,
  type CommitmentDirection,
  type CommitmentForOccurrences,
} from "@/lib/engines/commitments";

const THIRTY_DAY_FALLBACK_DAYS = 30;
const SALARY_SEARCH_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type HeadroomWindowBasis = "NEXT_SALARY" | "THIRTY_DAY";

export type HeadroomWindow = {
  from: Date;
  to: Date;
  days: number;
  basis: HeadroomWindowBasis;
};

export type HeadroomLineKind = "BALANCE" | "INFLOW" | "OUTFLOW" | "VARIABLE_ESTIMATE";

export type HeadroomLine = {
  label: string;
  /** Signed: positive for balances and inflows, negative for outflows and the variable estimate. */
  amount: Money;
  date: Date | null;
  kind: HeadroomLineKind;
  sourceId: string | null;
  isEstimate: boolean;
};

export type HeadroomResult = {
  amount: Money;
  window: HeadroomWindow;
  lines: HeadroomLine[];
  assumptions: string[];
};

export type HeadroomAccountInput = {
  id: string;
  name: string;
  currentBalance: Decimal.Value;
};

export type HeadroomCommitmentInput = CommitmentForOccurrences & {
  /** Only "SALARY" is special-cased, to resolve the window. */
  category: string;
  /** Whether the amount varies each time — surfaced on the line as `isEstimate`. */
  isVariable: boolean;
};

export type HeadroomVariableSpendInput = {
  monthlyAmount: Decimal.Value;
} | null;

export type CalculateHeadroomInput = {
  /** Injected clock — the engine never reads the system clock itself. */
  now: Date;
  accounts: HeadroomAccountInput[];
  commitments: HeadroomCommitmentInput[];
  variableSpendBaseline: HeadroomVariableSpendInput;
};

type SalaryOccurrence = { commitmentId: string; date: Date };

/**
 * The earliest occurrence, on or after `from`, of any active SALARY
 * commitment — searched up to a year out. Returns the specific
 * (commitment, date) pair so the caller can exclude exactly that
 * occurrence from the sum without excluding anything else due the same day.
 */
function findNextSalaryOccurrence(
  commitments: HeadroomCommitmentInput[],
  from: Date,
): SalaryOccurrence | null {
  const salaryCommitments = commitments.filter((c) => c.category === "SALARY" && c.isActive);
  if (salaryCommitments.length === 0) {
    return null;
  }

  const searchWindow = { from, to: addDays(from, SALARY_SEARCH_DAYS) };
  let earliest: SalaryOccurrence | null = null;

  for (const commitment of salaryCommitments) {
    const [first] = generateOccurrences(commitment, searchWindow);
    if (first && (!earliest || first.date.getTime() < earliest.date.getTime())) {
      earliest = { commitmentId: commitment.id, date: first.date };
    }
  }

  return earliest;
}

function resolveWindow(
  commitments: HeadroomCommitmentInput[],
  now: Date,
): { window: HeadroomWindow; excludedSalary: SalaryOccurrence | null } {
  const from = startOfIstDay(now);
  const nextSalary = findNextSalaryOccurrence(commitments, from);
  const to = nextSalary ? nextSalary.date : addDays(from, THIRTY_DAY_FALLBACK_DAYS);
  const basis: HeadroomWindowBasis = nextSalary ? "NEXT_SALARY" : "THIRTY_DAY";
  const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);

  return {
    window: { from, to, days, basis },
    excludedSalary: nextSalary,
  };
}

function signedAmount(direction: CommitmentDirection, amount: Money): Money {
  return direction === "OUTFLOW" ? amount.negated() : amount;
}

/**
 * Computes the Headroom Number: what's genuinely available to spend
 * between now and the window's end, netting out every known commitment
 * and a pro-rated estimate of ordinary variable spending. Returns the
 * full itemised breakdown behind the figure — every line traceable to a
 * source record — because a number the user can't interrogate is a
 * number they won't trust.
 */
export function calculateHeadroom(input: CalculateHeadroomInput): HeadroomResult {
  const { now, accounts, commitments, variableSpendBaseline } = input;
  const { window, excludedSalary } = resolveWindow(commitments, now);

  const lines: HeadroomLine[] = [];
  let total = toMoney(0);

  for (const account of accounts) {
    const amount = toMoney(account.currentBalance);
    lines.push({
      label: account.name,
      amount,
      date: null,
      kind: "BALANCE",
      sourceId: account.id,
      isEstimate: false,
    });
    total = total.plus(amount);
  }

  for (const commitment of commitments) {
    const occurrences = generateOccurrences(commitment, { from: window.from, to: window.to });
    for (const occurrence of occurrences) {
      const isExcludedSalary =
        excludedSalary &&
        occurrence.commitmentId === excludedSalary.commitmentId &&
        occurrence.date.getTime() === excludedSalary.date.getTime();
      if (isExcludedSalary) {
        continue;
      }

      const amount = signedAmount(commitment.direction, occurrence.amount);
      lines.push({
        label: commitment.name,
        amount,
        date: occurrence.date,
        kind: commitment.direction,
        sourceId: commitment.id,
        isEstimate: commitment.isVariable,
      });
      total = total.plus(amount);
    }
  }

  const assumptions: string[] = [];

  if (variableSpendBaseline) {
    const { year, month } = getIstParts(window.from);
    const daysInThisMonth = daysInMonth(year, month);
    const proRated = toMoney(variableSpendBaseline.monthlyAmount)
      .times(window.days)
      .div(daysInThisMonth);
    lines.push({
      label: "Typical variable spend",
      amount: proRated.negated(),
      date: null,
      kind: "VARIABLE_ESTIMATE",
      sourceId: null,
      isEstimate: true,
    });
    total = total.minus(proRated);
    assumptions.push(
      `Variable spend is your ₹${variableSpendBaseline.monthlyAmount}/month estimate, pro-rated for ${window.days} of ${daysInThisMonth} days.`,
    );
  } else {
    assumptions.push(
      "No variable spend estimate is set, so ordinary day-to-day spending isn't netted out of this figure.",
    );
  }

  assumptions.push(
    window.basis === "NEXT_SALARY"
      ? "The window runs to your next expected salary credit, which isn't counted in this figure — it starts the next period."
      : "No salary commitment was found, so this uses a default 30-day window.",
  );

  return { amount: total, window, lines, assumptions };
}
