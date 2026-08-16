import Decimal from "decimal.js";
import { roundCurrency, sum, toMoney, type Money } from "@/lib/money";
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
