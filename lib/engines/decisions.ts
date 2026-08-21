import type Decimal from "decimal.js";
import { addDays } from "date-fns";
import { max, sum, toMoney, type Money } from "@/lib/money";
import { financialYearOf } from "@/lib/dates";
import {
  applyPrepayments,
  computeSection24bDeduction,
  effectivePostTaxCostOfDebt,
  generateAmortisationSchedule,
  type PrepaymentMode,
  type TaxProfile,
} from "@/lib/engines/amortisation";
import {
  projectCashFlow,
  summariseRecurringCommitments,
  type ProjectionHorizonDays,
  type ProjectionResult,
} from "@/lib/engines/ahead";
import {
  calculateHeadroom,
  type HeadroomCommitmentInput,
  type HeadroomVariableSpendInput,
} from "@/lib/engines/headroom";
import {
  deriveEmiCommitmentFields,
  generateOccurrences,
  type CommitmentForOccurrences,
} from "@/lib/engines/commitments";
import { monthsToReachTarget } from "@/lib/engines/goals";

// ---------------------------------------------------------------------------
// Prepay vs invest
// ---------------------------------------------------------------------------

export type InvestReturnRates = {
  pessimisticPercent: Decimal.Value;
  basePercent: Decimal.Value;
  optimisticPercent: Decimal.Value;
};

export const DEFAULT_INVEST_RETURN_RATES: InvestReturnRates = {
  pessimisticPercent: "8",
  basePercent: "12",
  optimisticPercent: "15",
};

export type PrepayVsInvestInput = {
  liability: {
    outstandingPrincipal: Decimal.Value;
    annualRatePercent: Decimal.Value;
    remainingTenureMonths: number;
    /** The next EMI due date — the schedule is modelled from here. */
    firstDueDate: Date;
    prepaymentPenaltyPercent?: Decimal.Value;
    isSelfOccupied: boolean;
  };
  lumpSum: Decimal.Value;
  prepaymentMode: PrepaymentMode;
  taxProfile: TaxProfile;
  investmentReturnRates?: InvestReturnRates;
  /** Applied to the investment gain only, at exit. Default 12.5% (LTCG on equity-oriented funds). */
  capitalGainsTaxPercent?: Decimal.Value;
};

/**
 * Derives how many EMIs actually remain on a stored loan, and the date
 * the next one falls due, as of `now`. Reuses the same EMI-commitment
 * derivation and occurrence generation already verified elsewhere,
 * rather than re-deriving month arithmetic here.
 */
export function deriveRemainingScheduleParams(
  liability: { emiAmount: Decimal.Value; emiDayOfMonth: number; startDate: Date; tenureMonths: number },
  now: Date,
): { remainingTenureMonths: number; firstDueDate: Date } {
  const emiFields = deriveEmiCommitmentFields(liability);
  const syntheticEmiCommitment: CommitmentForOccurrences = {
    id: "emi",
    name: "EMI",
    direction: "OUTFLOW",
    amount: emiFields.amount,
    frequency: "MONTHLY",
    anchorDate: emiFields.anchorDate,
    dayOfMonth: emiFields.dayOfMonth,
    endDate: emiFields.endDate,
    isActive: true,
  };

  const remaining = generateOccurrences(syntheticEmiCommitment, { from: now, to: emiFields.endDate });
  if (remaining.length === 0) {
    throw new Error("This loan has already reached its scheduled payoff date.");
  }

  return { remainingTenureMonths: remaining.length, firstDueDate: remaining[0].date };
}

export type PrepayBranchResult = {
  interestSaved: Money;
  monthsSaved: number;
  originalPayoffDate: Date;
  newPayoffDate: Date;
  penaltyCost: Money;
  /** The value of the Section 24(b) deduction given up because less interest will be paid. Zero under the New regime. */
  lostDeductionValue: Money;
  /** interestSaved − penaltyCost − lostDeductionValue. */
  netBenefit: Money;
};

export type InvestScenarioLabel = "PESSIMISTIC" | "BASE" | "OPTIMISTIC";

export type InvestScenario = {
  label: InvestScenarioLabel;
  annualReturnPercent: Money;
  /** Before capital gains tax. */
  projectedValue: Money;
  capitalGainsTax: Money;
  /** After capital gains tax — what you'd actually have in hand. */
  postTaxValue: Money;
};

export type PrepayVsInvestResult = {
  prepay: PrepayBranchResult;
  investScenarios: InvestScenario[];
  /** The guaranteed, post-tax rate prepaying represents — the rate investing must clear to win. */
  hurdleRatePercent: Money;
};

const DEFAULT_CAPITAL_GAINS_TAX_PERCENT = "12.5";

function totalYearlyDeductibleInterest(
  periods: { dueDate: Date; interest: Money }[],
  isSelfOccupied: boolean,
): Money {
  const byFinancialYear = new Map<string, Money>();
  for (const period of periods) {
    const label = financialYearOf(period.dueDate).label;
    byFinancialYear.set(label, (byFinancialYear.get(label) ?? toMoney(0)).plus(period.interest));
  }
  return sum(
    Array.from(byFinancialYear.values()).map((yearlyInterest) =>
      computeSection24bDeduction(yearlyInterest, { isSelfOccupied }),
    ),
  );
}

/**
 * Compound growth of a lump sum at a fixed nominal annual rate, over a
 * given number of months — pre-tax. Exported so the Decide screen can
 * sample it at intermediate points to chart growth over time, using
 * exactly the same formula this engine uses for the final value.
 */
export function projectedInvestmentValue(
  lumpSum: Decimal.Value,
  annualRatePercent: Decimal.Value,
  months: number,
): Money {
  const rate = toMoney(annualRatePercent).div(100);
  const years = toMoney(months).div(12);
  return toMoney(lumpSum).times(rate.plus(1).pow(years));
}

/**
 * Models prepaying a lump sum against a loan versus investing it instead.
 * Both branches use the same deterministic arithmetic that powers the
 * amortisation engine — nothing here is estimated by a language model.
 * Presents both; recommends neither.
 */
export function prepayVsInvest(input: PrepayVsInvestInput): PrepayVsInvestResult {
  const { liability, lumpSum, prepaymentMode, taxProfile } = input;
  const returnRates = input.investmentReturnRates ?? DEFAULT_INVEST_RETURN_RATES;
  const capitalGainsTaxPercent = input.capitalGainsTaxPercent ?? DEFAULT_CAPITAL_GAINS_TAX_PERCENT;

  const baseAmortisationInput = {
    principal: liability.outstandingPrincipal,
    annualRatePercent: liability.annualRatePercent,
    tenureMonths: liability.remainingTenureMonths,
    firstDueDate: liability.firstDueDate,
  };

  const baseline = generateAmortisationSchedule(baseAmortisationInput);
  const withPrepayment = applyPrepayments(baseAmortisationInput, [
    {
      afterPeriod: 0,
      amount: lumpSum,
      mode: prepaymentMode,
      penaltyPercent: liability.prepaymentPenaltyPercent,
    },
  ]);

  const lostDeductionValue =
    taxProfile.regime === "OLD"
      ? totalYearlyDeductibleInterest(baseline.periods, liability.isSelfOccupied)
          .minus(totalYearlyDeductibleInterest(withPrepayment.periods, liability.isSelfOccupied))
          .times(toMoney(taxProfile.taxSlabPercent))
          .div(100)
      : toMoney(0);

  const netBenefit = withPrepayment.interestSaved
    .minus(withPrepayment.totalPenalties)
    .minus(lostDeductionValue);

  const prepay: PrepayBranchResult = {
    interestSaved: withPrepayment.interestSaved,
    monthsSaved: withPrepayment.monthsSaved,
    originalPayoffDate: baseline.payoffDate,
    newPayoffDate: withPrepayment.payoffDate,
    penaltyCost: withPrepayment.totalPenalties,
    lostDeductionValue,
    netBenefit,
  };

  const firstYearInterest = sum(baseline.periods.slice(0, 12).map((p) => p.interest));
  const hurdleRatePercent = effectivePostTaxCostOfDebt(
    liability.annualRatePercent,
    firstYearInterest,
    taxProfile,
    { isSelfOccupied: liability.isSelfOccupied },
  );

  const scenarios: [InvestScenarioLabel, Decimal.Value][] = [
    ["PESSIMISTIC", returnRates.pessimisticPercent],
    ["BASE", returnRates.basePercent],
    ["OPTIMISTIC", returnRates.optimisticPercent],
  ];

  const investScenarios: InvestScenario[] = scenarios.map(([label, ratePercent]) => {
    const projectedValue = projectedInvestmentValue(lumpSum, ratePercent, liability.remainingTenureMonths);
    const gain = max(projectedValue.minus(lumpSum), 0);
    const capitalGainsTax = gain.times(toMoney(capitalGainsTaxPercent)).div(100);
    return {
      label,
      annualReturnPercent: toMoney(ratePercent),
      projectedValue,
      capitalGainsTax,
      postTaxValue: projectedValue.minus(capitalGainsTax),
    };
  });

  return { prepay, investScenarios, hurdleRatePercent };
}

// ---------------------------------------------------------------------------
// Affordability check
// ---------------------------------------------------------------------------

export type GoalForAffordability = {
  id: string;
  name: string;
  currentAmount: Decimal.Value;
  targetAmount: Decimal.Value;
  monthlyContribution: Decimal.Value;
  expectedAnnualReturnPercent: Decimal.Value;
};

export type AffordabilityInput = {
  now: Date;
  purchaseAmount: Decimal.Value;
  purchaseDate: Date;
  accounts: { currentBalance: Decimal.Value }[];
  commitments: HeadroomCommitmentInput[];
  emergencyFundTargetMonths: number;
  goals: GoalForAffordability[];
};

export type CommitmentAtRisk = {
  id: string;
  name: string;
  date: Date;
  amount: Money;
};

export type GoalImpact = {
  goalId: string;
  goalName: string;
  baselineMonthsToTarget: number | null;
  afterPurchaseMonthsToTarget: number | null;
  monthsDelayed: number;
};

export type AffordabilityResult = {
  resultingHeadroom: Money;
  commitmentsAtRisk: CommitmentAtRisk[];
  emergencyFundMonthsBefore: Money;
  emergencyFundMonthsAfter: Money;
  goalImpacts: GoalImpact[];
  assumptions: string[];
};

function asCommitmentForOccurrences(commitment: HeadroomCommitmentInput): CommitmentForOccurrences {
  return commitment;
}

/**
 * Checks whether a one-time purchase is affordable: what it does to
 * available cash, which upcoming commitments it puts at risk, how it
 * changes emergency-fund coverage, and how it delays active goals.
 */
export function checkAffordability(input: AffordabilityInput): AffordabilityResult {
  const { now, purchaseAmount, purchaseDate, accounts, commitments, emergencyFundTargetMonths, goals } =
    input;

  const purchaseCommitment: HeadroomCommitmentInput = {
    id: "__purchase__",
    name: "This purchase",
    direction: "OUTFLOW",
    category: "OTHER",
    amount: purchaseAmount,
    frequency: "ONE_TIME",
    anchorDate: purchaseDate,
    dayOfMonth: null,
    endDate: null,
    isActive: true,
    isVariable: false,
  };

  const headroomWithPurchase = calculateHeadroom({
    now,
    accounts: accounts.map((a, index) => ({
      id: `acc-${index}`,
      name: "Account",
      currentBalance: a.currentBalance,
    })),
    commitments: [...commitments, purchaseCommitment],
    variableSpendBaseline: null,
  });

  const projectionHorizon: ProjectionHorizonDays = 90;
  const withoutPurchase = projectCashFlow({
    now,
    horizonDays: projectionHorizon,
    accounts,
    commitments: commitments.map(asCommitmentForOccurrences),
  });
  const withPurchase = projectCashFlow({
    now,
    horizonDays: projectionHorizon,
    accounts,
    commitments: [...commitments.map(asCommitmentForOccurrences), purchaseCommitment],
  });

  // Only flag risk this purchase specifically introduces: either there was
  // no pre-existing shortfall at all, or the purchase drags the first
  // negative crossing earlier than it would otherwise have happened.
  const purchaseIntroducesNewRisk =
    withPurchase.goesNegative &&
    (!withoutPurchase.goesNegative ||
      withPurchase.firstNegativeDate!.getTime() < withoutPurchase.firstNegativeDate!.getTime());

  const commitmentsAtRisk: CommitmentAtRisk[] = purchaseIntroducesNewRisk
    ? withPurchase.points
        .filter(
          (point) =>
            point.sourceId !== "__purchase__" &&
            point.date.getTime() >= withPurchase.firstNegativeDate!.getTime(),
        )
        .map((point) => ({
          id: point.sourceId,
          name: point.label,
          date: point.date,
          amount: point.amount,
        }))
    : [];

  const monthlyFixedTotal = summariseRecurringCommitments(commitments).monthlyOutflowTotal;
  const liquidBefore = sum(accounts.map((a) => a.currentBalance));
  const liquidAfter = liquidBefore.minus(purchaseAmount);
  const emergencyFundMonthsBefore = monthlyFixedTotal.isZero()
    ? toMoney(0)
    : liquidBefore.div(monthlyFixedTotal);
  const emergencyFundMonthsAfter = monthlyFixedTotal.isZero()
    ? toMoney(0)
    : liquidAfter.div(monthlyFixedTotal);

  // If the purchase doesn't create a shortfall, goals proceed on schedule.
  // If it does, we assume the shortfall is made up by skipping goal
  // contributions until it's covered — a simplification, stated explicitly
  // in `assumptions`, since V0 has no way to know which goal the user would
  // actually sacrifice.
  const shortfall = max(toMoney(purchaseAmount).minus(liquidBefore), 0);

  const goalImpacts: GoalImpact[] = goals.map((goal) => {
    const baselineMonths = monthsToReachTarget(
      goal.currentAmount,
      goal.targetAmount,
      goal.monthlyContribution,
      goal.expectedAnnualReturnPercent,
    );

    if (shortfall.isZero()) {
      return {
        goalId: goal.id,
        goalName: goal.name,
        baselineMonthsToTarget: baselineMonths,
        afterPurchaseMonthsToTarget: baselineMonths,
        monthsDelayed: 0,
      };
    }

    const monthlyContribution = toMoney(goal.monthlyContribution);
    const monthsOfContributionLost = monthlyContribution.isZero()
      ? 0
      : shortfall.div(monthlyContribution).ceil().toNumber();

    // The skipped months earn no growth and add no principal, so — with
    // the same target and pace either side of the gap — the delay is
    // simply those months added on top of the baseline timeline.
    const afterPurchaseMonths = baselineMonths === null ? null : baselineMonths + monthsOfContributionLost;

    return {
      goalId: goal.id,
      goalName: goal.name,
      baselineMonthsToTarget: baselineMonths,
      afterPurchaseMonthsToTarget: afterPurchaseMonths,
      monthsDelayed: monthsOfContributionLost,
    };
  });

  const assumptions = [
    "Commitments at risk are whatever falls on or after the first date your projected balance would go negative, within a 90-day horizon.",
    "Emergency fund coverage divides your liquid balance by your recurring monthly commitments — it does not include variable spending.",
  ];
  const targetMonths = toMoney(emergencyFundTargetMonths);
  if (
    emergencyFundMonthsAfter.lessThan(targetMonths) &&
    !emergencyFundMonthsBefore.lessThan(targetMonths)
  ) {
    assumptions.push(
      `This purchase would drop your emergency fund below your ${emergencyFundTargetMonths}-month target.`,
    );
  }
  if (!shortfall.isZero()) {
    assumptions.push(
      "This purchase would create a shortfall; goal delays assume you'd skip contributions until it's covered, rather than pick a specific goal to sacrifice.",
    );
  }

  return {
    resultingHeadroom: headroomWithPurchase.amount,
    commitmentsAtRisk,
    emergencyFundMonthsBefore,
    emergencyFundMonthsAfter,
    goalImpacts,
    assumptions,
  };
}

// ---------------------------------------------------------------------------
// Income change
// ---------------------------------------------------------------------------

export type IncomeChangeInput = {
  now: Date;
  accounts: { currentBalance: Decimal.Value }[];
  commitments: HeadroomCommitmentInput[];
  /** The new total monthly salary — a raise, a cut, or a new job. */
  newMonthlySalary: Decimal.Value;
};

export type IncomeChangeResult = {
  currentMonthlySalary: Money;
  newMonthlySalary: Money;
  monthlySalaryDelta: Money;
  projectionBefore: ProjectionResult;
  projectionAfter: ProjectionResult;
  /** projectionAfter.endBalance − projectionBefore.endBalance, over the same 90-day horizon. */
  projectedEndBalanceDelta: Money;
  assumptions: string[];
};

const INCOME_CHANGE_PROJECTION_HORIZON: ProjectionHorizonDays = 90;

/**
 * Scales every active SALARY commitment so their combined monthly total
 * equals `newMonthlySalary`, preserving each one's relative share if
 * there's more than one. Throws if there's no salary commitment to scale —
 * this models a change to existing income, not adding income from scratch.
 */
function scaleSalaryCommitments(
  commitments: HeadroomCommitmentInput[],
  newMonthlySalary: Decimal.Value,
): { scaled: HeadroomCommitmentInput[]; currentMonthlySalary: Money } {
  const salaryCommitments = commitments.filter(
    (c) => c.isActive && c.direction === "INFLOW" && c.category === "SALARY",
  );
  if (salaryCommitments.length === 0) {
    throw new Error("Add a salary commitment on Ahead before modelling an income change.");
  }

  const currentMonthlySalary = sum(salaryCommitments.map((c) => c.amount));
  if (currentMonthlySalary.isZero()) {
    throw new Error("Your current salary commitment is ₹0, so it can't be scaled proportionally.");
  }

  const scaleFactor = toMoney(newMonthlySalary).div(currentMonthlySalary);
  const scaled = commitments.map((c) =>
    salaryCommitments.includes(c) ? { ...c, amount: toMoney(c.amount).times(scaleFactor) } : c,
  );

  return { scaled, currentMonthlySalary };
}

/**
 * Models a raise, a pay cut, or a job change: reruns a 90-day cash-flow
 * projection with every active salary commitment scaled to the new
 * monthly figure, and reports the difference against today's numbers.
 * Deliberately does not compare Headroom Numbers before and after — the
 * Headroom window always ends at the next salary credit and excludes that
 * exact occurrence from its sum, so a same-window income change is
 * invisible to it by construction. The 90-day projection, which applies
 * every occurrence on its real due date, is where the change actually
 * shows up.
 */
export function incomeChangeImpact(input: IncomeChangeInput): IncomeChangeResult {
  const { now, accounts, commitments, newMonthlySalary } = input;
  const { scaled, currentMonthlySalary } = scaleSalaryCommitments(commitments, newMonthlySalary);

  const projectionBefore = projectCashFlow({
    now,
    horizonDays: INCOME_CHANGE_PROJECTION_HORIZON,
    accounts,
    commitments: commitments.map(asCommitmentForOccurrences),
  });
  const projectionAfter = projectCashFlow({
    now,
    horizonDays: INCOME_CHANGE_PROJECTION_HORIZON,
    accounts,
    commitments: scaled.map(asCommitmentForOccurrences),
  });

  return {
    currentMonthlySalary,
    newMonthlySalary: toMoney(newMonthlySalary),
    monthlySalaryDelta: toMoney(newMonthlySalary).minus(currentMonthlySalary),
    projectionBefore,
    projectionAfter,
    projectedEndBalanceDelta: projectionAfter.endBalance.minus(projectionBefore.endBalance),
    assumptions: [
      "Every active SALARY commitment is scaled proportionally to reach the new monthly total — if you have more than one, their relative split is preserved.",
      "Shown as a 90-day cash-flow projection, not a change in your Headroom Number — the Headroom window always ends at your next salary credit and excludes that exact payment, so it wouldn't move even though your income did.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Job loss runway
// ---------------------------------------------------------------------------

export type JobLossRunwayInput = {
  now: Date;
  accounts: { currentBalance: Decimal.Value }[];
  commitments: HeadroomCommitmentInput[];
  variableSpendBaseline: HeadroomVariableSpendInput;
  emergencyFundTargetMonths: number;
  /** How far out to project before giving up and reporting no depletion date. Default 730 (24 months). */
  horizonDays?: number;
};

export type JobLossRunwayResult = {
  startingBalance: Money;
  /** Steady-state monthly burn: recurring outflow commitments plus the variable-spend estimate. */
  monthlyBurn: Money;
  runwayDays: number | null;
  depletionDate: Date | null;
  emergencyFundCoverageMonths: Money;
  meetsEmergencyFundTarget: boolean;
  assumptions: string[];
};

const DEFAULT_JOB_LOSS_HORIZON_DAYS = 730;
const AVERAGE_DAYS_PER_MONTH = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Projects how long a liquid balance lasts if salary stops today: every
 * other scheduled commitment (EMIs, rent, SIPs, other inflows) is applied
 * on its real due date via the same occurrence generation the Ahead
 * engine uses, and the variable-spend estimate is drawn down smoothly
 * between those dates. Returns the first date the running balance would
 * go negative, or null if it wouldn't within the horizon.
 */
export function jobLossRunway(input: JobLossRunwayInput): JobLossRunwayResult {
  const { now, accounts, commitments, variableSpendBaseline, emergencyFundTargetMonths } = input;
  const horizonDays = input.horizonDays ?? DEFAULT_JOB_LOSS_HORIZON_DAYS;
  const horizonEnd = addDays(now, horizonDays);

  const startingBalance = sum(accounts.map((a) => a.currentBalance));

  // Job loss stops the SALARY inflow specifically; every other scheduled
  // commitment — EMIs, rent, SIPs, any other inflow — is assumed to continue.
  const survivingCommitments = commitments.filter(
    (c) => !(c.direction === "INFLOW" && c.category === "SALARY"),
  );

  const occurrences = survivingCommitments
    .flatMap((commitment) =>
      generateOccurrences(commitment, { from: now, to: horizonEnd }).map((occurrence) => ({
        commitment,
        occurrence,
      })),
    )
    .sort((a, b) => a.occurrence.date.getTime() - b.occurrence.date.getTime());

  const dailyVariableBurn = variableSpendBaseline
    ? toMoney(variableSpendBaseline.monthlyAmount).div(AVERAGE_DAYS_PER_MONTH)
    : toMoney(0);

  let running = startingBalance;
  let cursor = now;
  let depletionDate: Date | null = startingBalance.isNegative() ? now : null;

  const drawDownVariableBurnTo = (target: Date) => {
    if (depletionDate || dailyVariableBurn.isZero() || target.getTime() <= cursor.getTime()) {
      cursor = target;
      return;
    }
    const days = (target.getTime() - cursor.getTime()) / MS_PER_DAY;
    const burn = dailyVariableBurn.times(days);
    if (running.minus(burn).isNegative()) {
      const daysUntilZero = running.div(dailyVariableBurn).toNumber();
      depletionDate = addDays(cursor, daysUntilZero);
    } else {
      running = running.minus(burn);
    }
    cursor = target;
  };

  for (const { commitment, occurrence } of occurrences) {
    if (depletionDate) {
      break;
    }
    drawDownVariableBurnTo(occurrence.date);
    if (depletionDate) {
      break;
    }
    const amount = commitment.direction === "OUTFLOW" ? occurrence.amount.negated() : occurrence.amount;
    running = running.plus(amount);
    if (running.isNegative()) {
      depletionDate = occurrence.date;
    }
  }
  if (!depletionDate) {
    drawDownVariableBurnTo(horizonEnd);
  }

  const runwayDays = depletionDate
    ? Math.max(0, Math.round((depletionDate.getTime() - now.getTime()) / MS_PER_DAY))
    : null;

  const monthlyOutflowTotal = summariseRecurringCommitments(survivingCommitments).monthlyOutflowTotal;
  const monthlyBurn = variableSpendBaseline
    ? monthlyOutflowTotal.plus(variableSpendBaseline.monthlyAmount)
    : monthlyOutflowTotal;
  const emergencyFundCoverageMonths = monthlyBurn.isZero() ? toMoney(0) : startingBalance.div(monthlyBurn);

  return {
    startingBalance,
    monthlyBurn,
    runwayDays,
    depletionDate,
    emergencyFundCoverageMonths,
    meetsEmergencyFundTarget: emergencyFundCoverageMonths.gte(emergencyFundTargetMonths),
    assumptions: [
      "Assumes your salary stops today; every other scheduled commitment and inflow continues as planned.",
      "Variable day-to-day spending is drawn down smoothly — your monthly estimate ÷ 30 — between commitment dates, rather than on a specific date.",
      depletionDate === null
        ? `Your balance is projected to stay positive through the ${Math.round(horizonDays / AVERAGE_DAYS_PER_MONTH)}-month horizon this check looks at.`
        : "The depletion date is when your balance is first projected to go negative, not when it runs out of variable-spend headroom specifically.",
    ],
  };
}
