import type Decimal from "decimal.js";
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
} from "@/lib/engines/ahead";
import { calculateHeadroom, type HeadroomCommitmentInput } from "@/lib/engines/headroom";
import {
  deriveEmiCommitmentFields,
  generateOccurrences,
  type CommitmentForOccurrences,
} from "@/lib/engines/commitments";

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

const GOAL_PROJECTION_MAX_MONTHS = 1200;

/** Months of monthly contributions (compounding at the given rate) until currentAmount reaches targetAmount, or null if unreachable within 100 years. */
function monthsToReachGoal(
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
    const baselineMonths = monthsToReachGoal(
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
