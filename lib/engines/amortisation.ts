import Decimal from "decimal.js";
import { max, min, roundCurrency, subtract, sum, toMoney, type Money } from "@/lib/money";
import { addMonthsClamped } from "@/lib/dates";

export type AmortisationInput = {
  principal: Decimal.Value;
  annualRatePercent: Decimal.Value;
  tenureMonths: number;
  /** The due date of the first instalment. Subsequent dates step monthly from here. */
  firstDueDate: Date;
};

export type AmortisationPeriod = {
  /** 1-indexed. */
  period: number;
  dueDate: Date;
  openingBalance: Money;
  /** The instalment actually paid this period. Equal to the level EMI except
   * in the final period, which absorbs any rounding drift so the balance
   * closes at exactly zero. */
  emi: Money;
  interest: Money;
  principal: Money;
  closingBalance: Money;
};

export type AmortisationSchedule = {
  /** The level monthly instalment as stated in the loan agreement. */
  emi: Money;
  periods: AmortisationPeriod[];
  totalInterest: Money;
  totalPaid: Money;
  payoffDate: Date;
};

/** The monthly interest rate implied by an annual rate, under monthly compounding. */
function monthlyRate(annualRatePercent: Decimal.Value): Decimal {
  return toMoney(annualRatePercent).div(12).div(100);
}

/**
 * The level monthly instalment for a reducing-balance loan, rounded to the
 * rupee-paisa precision an actual EMI is quoted at.
 *
 * EMI = P × r × (1 + r)^n / ((1 + r)^n − 1), or P / n when r = 0.
 */
export function calculateEmi(
  principal: Decimal.Value,
  annualRatePercent: Decimal.Value,
  tenureMonths: number,
): Money {
  if (tenureMonths <= 0) {
    throw new Error("calculateEmi: tenureMonths must be at least 1");
  }

  const principalAmount = toMoney(principal);
  const r = monthlyRate(annualRatePercent);

  if (r.isZero()) {
    return roundCurrency(principalAmount.div(tenureMonths), 2);
  }

  const factor = r.plus(1).pow(tenureMonths);
  const emi = principalAmount.times(r).times(factor).div(factor.minus(1));
  return roundCurrency(emi, 2);
}

/**
 * Generates the full amortisation schedule for a reducing-balance loan.
 * Deterministic and side-effect free: every date is derived from
 * `firstDueDate`, nothing reads the system clock.
 */
export function generateAmortisationSchedule(input: AmortisationInput): AmortisationSchedule {
  const { principal, annualRatePercent, tenureMonths, firstDueDate } = input;

  if (tenureMonths <= 0) {
    throw new Error("generateAmortisationSchedule: tenureMonths must be at least 1");
  }

  const principalAmount = toMoney(principal);
  const r = monthlyRate(annualRatePercent);
  const levelEmi = calculateEmi(principalAmount, annualRatePercent, tenureMonths);

  const periods: AmortisationPeriod[] = [];
  let outstanding = principalAmount;

  for (let period = 1; period <= tenureMonths; period++) {
    const openingBalance = outstanding;
    const dueDate = period === 1 ? firstDueDate : addMonthsClamped(firstDueDate, period - 1);
    const interest = roundCurrency(openingBalance.times(r), 2);

    const isFinalPeriod = period === tenureMonths;
    // The final instalment always clears whatever balance remains, so the
    // schedule closes at exactly zero regardless of rounding drift
    // accumulated over the preceding periods.
    const principalPortion = isFinalPeriod ? openingBalance : levelEmi.minus(interest);
    const closingBalance = isFinalPeriod ? new Decimal(0) : openingBalance.minus(principalPortion);
    const emi = isFinalPeriod ? interest.plus(principalPortion) : levelEmi;

    periods.push({
      period,
      dueDate,
      openingBalance,
      emi,
      interest,
      principal: principalPortion,
      closingBalance,
    });

    outstanding = closingBalance;
  }

  const totalInterest = sum(periods.map((p) => p.interest));
  const totalPaid = sum(periods.map((p) => p.emi));
  const payoffDate = periods[periods.length - 1].dueDate;

  return { emi: levelEmi, periods, totalInterest, totalPaid, payoffDate };
}

// ---------------------------------------------------------------------------
// Prepayment scenarios
// ---------------------------------------------------------------------------

export type PrepaymentMode = "REDUCE_TENURE" | "REDUCE_EMI";

export type PrepaymentEvent = {
  /** The regular instalment period after which this lump sum is applied.
   * 0 applies it before the first instalment is even due. */
  afterPeriod: number;
  amount: Decimal.Value;
  mode: PrepaymentMode;
  /** Percent of the prepaid amount charged as a penalty, if any. */
  penaltyPercent?: Decimal.Value;
};

export type AmortisationPeriodWithPrepayment = AmortisationPeriod & {
  prepayment: Money;
  prepaymentPenalty: Money;
};

export type AmortisationScheduleWithPrepayments = {
  periods: AmortisationPeriodWithPrepayment[];
  totalInterest: Money;
  /** Sum of regular instalments only — excludes prepayments and penalties. */
  totalPaid: Money;
  totalPrepaid: Money;
  totalPenalties: Money;
  payoffDate: Date;
  /** Original tenure minus the number of periods this schedule actually took. */
  monthsSaved: number;
  /** Original total interest minus this schedule's total interest. */
  interestSaved: Money;
};

/**
 * Re-runs the amortisation schedule with one or more lump-sum prepayments
 * applied. `REDUCE_TENURE` (the Indian bank default) keeps the instalment
 * constant and finishes early; `REDUCE_EMI` keeps the original payoff date
 * and recalculates a lower instalment on the reduced balance. Multiple
 * events — a single one-off prepayment, or several, standing in for a
 * recurring extra payment — are applied in period order.
 */
export function applyPrepayments(
  input: AmortisationInput,
  prepayments: PrepaymentEvent[],
): AmortisationScheduleWithPrepayments {
  const { principal, annualRatePercent, tenureMonths, firstDueDate } = input;

  if (tenureMonths <= 0) {
    throw new Error("applyPrepayments: tenureMonths must be at least 1");
  }

  const baseline = generateAmortisationSchedule(input);
  const r = monthlyRate(annualRatePercent);

  const eventsByPeriod = new Map<number, PrepaymentEvent[]>();
  for (const event of prepayments) {
    const list = eventsByPeriod.get(event.afterPeriod) ?? [];
    list.push(event);
    eventsByPeriod.set(event.afterPeriod, list);
  }

  const periods: AmortisationPeriodWithPrepayment[] = [];
  let outstanding = toMoney(principal);
  let currentEmi = calculateEmi(principal, annualRatePercent, tenureMonths);
  let totalPenalties: Money = toMoney(0);
  let totalPrepaid: Money = toMoney(0);

  // A prepayment recorded "before period 1" (afterPeriod 0).
  for (const event of eventsByPeriod.get(0) ?? []) {
    const applied = min(toMoney(event.amount), outstanding);
    outstanding = outstanding.minus(applied);
    totalPrepaid = totalPrepaid.plus(applied);
    if (event.penaltyPercent) {
      totalPenalties = totalPenalties.plus(applied.times(toMoney(event.penaltyPercent)).div(100));
    }
    if (event.mode === "REDUCE_EMI" && outstanding.greaterThan(0)) {
      currentEmi = calculateEmi(outstanding, annualRatePercent, tenureMonths);
    }
  }

  let period = 0;
  while (outstanding.greaterThan(0) && period < tenureMonths) {
    period++;
    // Periods remaining in the original tenure after this one closes —
    // what a REDUCE_EMI prepayment this period would recalculate against.
    const monthsRemainingAfterThisPeriod = tenureMonths - period;
    const openingBalance = outstanding;
    const dueDate = period === 1 ? firstDueDate : addMonthsClamped(firstDueDate, period - 1);
    const interest = roundCurrency(openingBalance.times(r), 2);

    const isForcedFinal = period === tenureMonths;
    const wouldOverpay = !isForcedFinal && currentEmi.minus(interest).greaterThanOrEqualTo(openingBalance);
    const isFinal = isForcedFinal || wouldOverpay;

    const principalPortion = isFinal ? openingBalance : currentEmi.minus(interest);
    let closingBalance = isFinal ? toMoney(0) : openingBalance.minus(principalPortion);
    const emi = isFinal ? interest.plus(principalPortion) : currentEmi;

    let prepaymentThisPeriod: Money = toMoney(0);
    let penaltyThisPeriod: Money = toMoney(0);

    for (const event of eventsByPeriod.get(period) ?? []) {
      if (closingBalance.isZero()) break;
      const applied = min(toMoney(event.amount), closingBalance);
      closingBalance = closingBalance.minus(applied);
      prepaymentThisPeriod = prepaymentThisPeriod.plus(applied);
      if (event.penaltyPercent) {
        const penalty = applied.times(toMoney(event.penaltyPercent)).div(100);
        penaltyThisPeriod = penaltyThisPeriod.plus(penalty);
      }
      if (event.mode === "REDUCE_EMI" && closingBalance.greaterThan(0)) {
        currentEmi = calculateEmi(closingBalance, annualRatePercent, monthsRemainingAfterThisPeriod);
      }
    }

    totalPrepaid = totalPrepaid.plus(prepaymentThisPeriod);
    totalPenalties = totalPenalties.plus(penaltyThisPeriod);

    periods.push({
      period,
      dueDate,
      openingBalance,
      emi,
      interest,
      principal: principalPortion,
      closingBalance,
      prepayment: prepaymentThisPeriod,
      prepaymentPenalty: penaltyThisPeriod,
    });

    outstanding = closingBalance;
  }

  const totalInterest = sum(periods.map((p) => p.interest));
  const totalPaid = sum(periods.map((p) => p.emi));
  const payoffDate = periods[periods.length - 1].dueDate;

  return {
    periods,
    totalInterest,
    totalPaid,
    totalPrepaid,
    totalPenalties,
    payoffDate,
    monthsSaved: tenureMonths - periods.length,
    interestSaved: baseline.totalInterest.minus(totalInterest),
  };
}

// ---------------------------------------------------------------------------
// Tax adjustment (old regime only — Section 24(b) and Section 80C)
// ---------------------------------------------------------------------------

export type TaxRegime = "OLD" | "NEW";

export type TaxProfile = {
  regime: TaxRegime;
  taxSlabPercent: Decimal.Value;
};

/** Section 24(b): interest deduction cap for a self-occupied property, per financial year. */
export const SECTION_24B_SELF_OCCUPIED_CAP = "200000";
/** Section 80C: aggregate deduction cap across all instruments, per financial year. */
export const SECTION_80C_AGGREGATE_CAP = "150000";

/**
 * The portion of a financial year's home-loan interest that is deductible
 * under Section 24(b). Uncapped for a let-out property; capped at
 * ₹2,00,000 for a self-occupied one. Old regime only — callers should not
 * call this for a New regime taxpayer.
 */
export function computeSection24bDeduction(
  annualInterestPaid: Decimal.Value,
  liability: { isSelfOccupied: boolean },
): Money {
  const interest = toMoney(annualInterestPaid);
  if (!liability.isSelfOccupied) {
    return interest;
  }
  return min(interest, SECTION_24B_SELF_OCCUPIED_CAP);
}

/**
 * The portion of a financial year's principal repayment that is deductible
 * under Section 80C, respecting the ₹1,50,000 cap shared across every 80C
 * instrument the taxpayer holds — pass what's already been used elsewhere
 * so this loan only claims what's left.
 */
export function computeSection80cDeduction(
  annualPrincipalPaid: Decimal.Value,
  otherSection80cUsed: Decimal.Value = 0,
): Money {
  const principal = toMoney(annualPrincipalPaid);
  const remainingCap = max(subtract(SECTION_80C_AGGREGATE_CAP, otherSection80cUsed), 0);
  return min(principal, remainingCap);
}

/**
 * The effective post-tax annual cost of a loan's interest: the nominal
 * rate, discounted by whatever fraction of this year's interest actually
 * earns a Section 24(b) deduction at the taxpayer's slab rate. Honest
 * rather than assumed — if interest paid exceeds the deduction cap, only
 * the deductible fraction reduces the effective rate, not the whole thing.
 * New-regime taxpayers get no benefit, since neither section applies.
 */
export function effectivePostTaxCostOfDebt(
  nominalAnnualRatePercent: Decimal.Value,
  annualInterestPaid: Decimal.Value,
  taxProfile: TaxProfile,
  liability: { isSelfOccupied: boolean },
): Money {
  const nominalRate = toMoney(nominalAnnualRatePercent);
  const interest = toMoney(annualInterestPaid);

  if (taxProfile.regime === "NEW" || interest.isZero()) {
    return nominalRate;
  }

  const deductible = computeSection24bDeduction(interest, liability);
  const deductibleFraction = deductible.div(interest);
  const slabFraction = toMoney(taxProfile.taxSlabPercent).div(100);
  const benefitFraction = deductibleFraction.times(slabFraction);

  return nominalRate.times(toMoney(1).minus(benefitFraction));
}
