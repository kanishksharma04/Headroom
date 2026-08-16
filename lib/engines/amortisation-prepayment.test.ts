import { describe, expect, it } from "vitest";
import {
  applyPrepayments,
  computeSection24bDeduction,
  computeSection80cDeduction,
  effectivePostTaxCostOfDebt,
  generateAmortisationSchedule,
} from "@/lib/engines/amortisation";
import { istDate } from "@/lib/dates";

/**
 * Fixture: ₹40,00,000 @ 8.6% / 240m, a ₹2,00,000 lump sum applied after
 * period 12. Hand-verified by independently re-implementing the same
 * reducing-balance algorithm in a throwaway script and cross-checking the
 * baseline totals against the Phase 6 fixture (which is itself verified
 * against an independent floating-point EMI calculation).
 */
const LOAN = {
  principal: "4000000",
  annualRatePercent: "8.6",
  tenureMonths: 240,
  firstDueDate: istDate(2026, 8, 5),
};

describe("applyPrepayments — REDUCE_TENURE", () => {
  it("matches the hand-verified interest saving and month reduction", () => {
    const result = applyPrepayments(LOAN, [
      { afterPeriod: 12, amount: "200000", mode: "REDUCE_TENURE" },
    ]);

    expect(result.periods).toHaveLength(214);
    expect(result.monthsSaved).toBe(26);
    expect(result.totalInterest.toFixed(2)).toBe("3663339.35");
    expect(result.interestSaved.toFixed(2)).toBe("728623.21");
    expect(result.totalPrepaid.toFixed(2)).toBe("200000.00");

    const closingPeriod = result.periods[result.periods.length - 1];
    expect(closingPeriod.closingBalance.toFixed(4)).toBe("0.0000");

    const prepayPeriod = result.periods[11];
    expect(prepayPeriod.prepayment.toFixed(2)).toBe("200000.00");
    expect(prepayPeriod.closingBalance.toFixed(2)).toBe("3721349.71");
  });

  it("keeps the instalment constant throughout, including before the prepayment", () => {
    const result = applyPrepayments(LOAN, [
      { afterPeriod: 12, amount: "200000", mode: "REDUCE_TENURE" },
    ]);

    for (const period of result.periods) {
      if (period.period === result.periods.length) continue; // final period absorbs rounding drift
      expect(period.emi.toFixed(2)).toBe("34966.51");
    }
  });
});

describe("applyPrepayments — REDUCE_EMI", () => {
  it("matches the hand-verified interest saving with the original tenure preserved", () => {
    const result = applyPrepayments(LOAN, [
      { afterPeriod: 12, amount: "200000", mode: "REDUCE_EMI" },
    ]);

    expect(result.periods).toHaveLength(240);
    expect(result.monthsSaved).toBe(0);
    expect(result.totalInterest.toFixed(2)).toBe("4185348.80");
    expect(result.interestSaved.toFixed(2)).toBe("206613.76");

    const periodAfterPrepay = result.periods[12];
    expect(periodAfterPrepay.emi.toFixed(2)).toBe("33183.12");
  });

  it("saves less interest than an equivalent REDUCE_TENURE prepayment", () => {
    const reduceTenure = applyPrepayments(LOAN, [
      { afterPeriod: 12, amount: "200000", mode: "REDUCE_TENURE" },
    ]);
    const reduceEmi = applyPrepayments(LOAN, [
      { afterPeriod: 12, amount: "200000", mode: "REDUCE_EMI" },
    ]);

    expect(reduceEmi.interestSaved.lessThan(reduceTenure.interestSaved)).toBe(true);
  });
});

describe("applyPrepayments — edge cases", () => {
  it("a prepayment large enough to clear the loan closes it immediately", () => {
    const result = applyPrepayments(
      { principal: "100000", annualRatePercent: "10", tenureMonths: 12, firstDueDate: LOAN.firstDueDate },
      [{ afterPeriod: 3, amount: "500000", mode: "REDUCE_TENURE" }],
    );

    expect(result.periods).toHaveLength(3);
    expect(result.periods[2].closingBalance.toFixed(4)).toBe("0.0000");
    // Only the outstanding balance is actually taken, not the full 500000 offered.
    expect(result.totalPrepaid.lessThan("500000")).toBe(true);
  });

  it("a prepayment before period 1 reduces the principal from the start", () => {
    const result = applyPrepayments(LOAN, [
      { afterPeriod: 0, amount: "500000", mode: "REDUCE_TENURE" },
    ]);
    expect(result.periods[0].openingBalance.toFixed(2)).toBe("3500000.00");
  });

  it("applies a prepayment penalty as a percentage of the amount prepaid", () => {
    const result = applyPrepayments(LOAN, [
      { afterPeriod: 12, amount: "200000", mode: "REDUCE_TENURE", penaltyPercent: "2" },
    ]);
    expect(result.totalPenalties.toFixed(2)).toBe("4000.00");
  });

  it("supports multiple prepayment events, standing in for a recurring extra payment", () => {
    const result = applyPrepayments(LOAN, [
      { afterPeriod: 12, amount: "50000", mode: "REDUCE_TENURE" },
      { afterPeriod: 24, amount: "50000", mode: "REDUCE_TENURE" },
      { afterPeriod: 36, amount: "50000", mode: "REDUCE_TENURE" },
    ]);
    expect(result.totalPrepaid.toFixed(2)).toBe("150000.00");
    expect(result.periods[result.periods.length - 1].closingBalance.toFixed(4)).toBe("0.0000");
  });

  it("with no prepayments, reproduces the baseline schedule exactly", () => {
    const baseline = generateAmortisationSchedule(LOAN);
    const result = applyPrepayments(LOAN, []);
    expect(result.periods).toHaveLength(baseline.periods.length);
    expect(result.totalInterest.toFixed(2)).toBe(baseline.totalInterest.toFixed(2));
    expect(result.interestSaved.toFixed(2)).toBe("0.00");
    expect(result.monthsSaved).toBe(0);
  });
});

describe("Section 24(b) interest deduction", () => {
  it("is uncapped for a let-out property", () => {
    const deduction = computeSection24bDeduction("500000", { isSelfOccupied: false });
    expect(deduction.toFixed(2)).toBe("500000.00");
  });

  it("is capped at ₹2,00,000 for a self-occupied property", () => {
    const deduction = computeSection24bDeduction("340800", { isSelfOccupied: true });
    expect(deduction.toFixed(2)).toBe("200000.00");
  });

  it("passes through interest below the cap unchanged", () => {
    const deduction = computeSection24bDeduction("150000", { isSelfOccupied: true });
    expect(deduction.toFixed(2)).toBe("150000.00");
  });
});

describe("Section 80C principal deduction", () => {
  it("is capped at ₹1,50,000 with no other usage", () => {
    expect(computeSection80cDeduction("200000").toFixed(2)).toBe("150000.00");
    expect(computeSection80cDeduction("100000").toFixed(2)).toBe("100000.00");
  });

  it("respects the cap already used by other 80C instruments", () => {
    expect(computeSection80cDeduction("100000", "100000").toFixed(2)).toBe("50000.00");
  });

  it("returns zero once the shared cap is already exhausted", () => {
    expect(computeSection80cDeduction("50000", "150000").toFixed(2)).toBe("0.00");
  });
});

describe("effectivePostTaxCostOfDebt", () => {
  it("old and new regime produce correctly divergent effective rates", () => {
    // Interest well within the ₹2L cap, so the full 30% slab benefit applies.
    const oldRegime = effectivePostTaxCostOfDebt(
      "8.6",
      "150000",
      { regime: "OLD", taxSlabPercent: "30" },
      { isSelfOccupied: true },
    );
    const newRegime = effectivePostTaxCostOfDebt(
      "8.6",
      "150000",
      { regime: "NEW", taxSlabPercent: "30" },
      { isSelfOccupied: true },
    );

    // Old regime: 8.6 * (1 - 0.30) = 6.02
    expect(oldRegime.toFixed(2)).toBe("6.02");
    // New regime gets no Section 24(b) benefit at all — the nominal rate stands.
    expect(newRegime.toFixed(2)).toBe("8.60");
    expect(oldRegime.lessThan(newRegime)).toBe(true);
  });

  it("prorates the benefit when interest paid exceeds the deduction cap", () => {
    // 340800 interest, only 200000 deductible -> benefit fraction is (200000/340800) * 30%.
    const rate = effectivePostTaxCostOfDebt(
      "8.6",
      "340800",
      { regime: "OLD", taxSlabPercent: "30" },
      { isSelfOccupied: true },
    );
    // 8.6 * (1 - (200000/340800)*0.30) = 8.6 * (1 - 0.176056...) = 8.6 * 0.823944 ≈ 7.086
    expect(rate.toFixed(2)).toBe("7.09");
  });

  it("is uncapped, and therefore fully benefits, for a let-out property", () => {
    const rate = effectivePostTaxCostOfDebt(
      "8.6",
      "340800",
      { regime: "OLD", taxSlabPercent: "30" },
      { isSelfOccupied: false },
    );
    // Full 30% benefit applies since nothing is capped.
    expect(rate.toFixed(2)).toBe("6.02");
  });
});
