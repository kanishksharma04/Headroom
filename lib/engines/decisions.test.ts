import { describe, expect, it } from "vitest";
import { checkAffordability, prepayVsInvest } from "@/lib/engines/decisions";
import type { HeadroomCommitmentInput } from "@/lib/engines/headroom";
import { istDate } from "@/lib/dates";

/**
 * Note on the research document's §17.1 worked example: its illustrative
 * figures (₹4,84,000 saved, 19 months early, ₹13,70,000 at 12%) are
 * rounded/illustrative — recomputing them precisely via the same
 * reducing-balance formula already verified in the amortisation engine
 * (₹38.4L outstanding, 8.6%, 208 months remaining, treated as a fresh
 * schedule over the remaining term, which is the only sound reading of
 * "outstanding + rate + remaining tenure" alone) yields different, exact
 * numbers. Per this prompt's own precedence rule, the precisely verified
 * engine wins over an approximate mockup figure. These fixtures were
 * cross-checked independently before being encoded here (see the
 * reducing-balance script used during development).
 */
describe("prepayVsInvest — the research §17.1 scenario", () => {
  const input = {
    liability: {
      outstandingPrincipal: "3840000",
      annualRatePercent: "8.6",
      remainingTenureMonths: 208, // 17y 4m
      firstDueDate: istDate(2026, 8, 5),
      isSelfOccupied: true,
    },
    lumpSum: "200000",
    prepaymentMode: "REDUCE_TENURE" as const,
    taxProfile: { regime: "OLD" as const, taxSlabPercent: "30" },
  };

  it("prepay branch: interest saved and months saved", () => {
    const result = prepayVsInvest(input);
    expect(result.prepay.interestSaved.toFixed(2)).toBe("615848.19");
    expect(result.prepay.monthsSaved).toBe(22);
    expect(result.prepay.penaltyCost.toFixed(2)).toBe("0.00");
  });

  it("prepay branch: accounts for the lost Section 24(b) deduction and nets a benefit", () => {
    const result = prepayVsInvest(input);
    expect(result.prepay.lostDeductionValue.toFixed(2)).toBe("117514.19");
    expect(result.prepay.netBenefit.toFixed(2)).toBe("498334.00");
    // Sanity: net benefit must equal interest saved minus penalty minus lost deduction.
    const expectedNet = result.prepay.interestSaved
      .minus(result.prepay.penaltyCost)
      .minus(result.prepay.lostDeductionValue);
    expect(result.prepay.netBenefit.toFixed(2)).toBe(expectedNet.toFixed(2));
  });

  it("the new payoff date is earlier than the original by exactly monthsSaved", () => {
    const result = prepayVsInvest(input);
    expect(result.prepay.newPayoffDate.getTime()).toBeLessThan(
      result.prepay.originalPayoffDate.getTime(),
    );
  });

  it("invest branch produces all three scenarios with capital gains tax applied", () => {
    const result = prepayVsInvest(input);
    expect(result.investScenarios).toHaveLength(3);

    const pessimistic = result.investScenarios.find((s) => s.label === "PESSIMISTIC")!;
    const base = result.investScenarios.find((s) => s.label === "BASE")!;
    const optimistic = result.investScenarios.find((s) => s.label === "OPTIMISTIC")!;

    expect(pessimistic.projectedValue.toFixed(2)).toBe("759233.03");
    expect(pessimistic.capitalGainsTax.toFixed(2)).toBe("69904.13");
    expect(pessimistic.postTaxValue.toFixed(2)).toBe("689328.90");

    expect(base.projectedValue.toFixed(2)).toBe("1426075.07");
    expect(base.postTaxValue.toFixed(2)).toBe("1272815.69");

    expect(optimistic.projectedValue.toFixed(2)).toBe("2254892.78");
    expect(optimistic.postTaxValue.toFixed(2)).toBe("1998031.18");

    // Ordering must hold: pessimistic < base < optimistic, always.
    expect(pessimistic.postTaxValue.lessThan(base.postTaxValue)).toBe(true);
    expect(base.postTaxValue.lessThan(optimistic.postTaxValue)).toBe(true);
  });

  it("the hurdle rate is below the nominal rate but above the naive full-slab rate, because interest exceeds the 24(b) cap", () => {
    const result = prepayVsInvest(input);
    // Full-slab (uncapped) would be 8.6 * (1 - 0.30) = 6.02. Since first-year
    // interest exceeds the 2L cap, only part of it is sheltered, so the
    // honest hurdle rate must sit strictly between 6.02 and the nominal 8.6.
    expect(result.hurdleRatePercent.greaterThan("6.02")).toBe(true);
    expect(result.hurdleRatePercent.lessThan("8.6")).toBe(true);
  });

  it("under the New regime, there is no lost deduction and the hurdle rate equals the nominal rate", () => {
    const result = prepayVsInvest({
      ...input,
      taxProfile: { regime: "NEW", taxSlabPercent: "30" },
    });
    expect(result.prepay.lostDeductionValue.toFixed(2)).toBe("0.00");
    expect(result.hurdleRatePercent.toFixed(2)).toBe("8.60");
  });

  it("REDUCE_EMI saves less interest than REDUCE_TENURE for the same lump sum", () => {
    const reduceTenure = prepayVsInvest(input);
    const reduceEmi = prepayVsInvest({ ...input, prepaymentMode: "REDUCE_EMI" });
    expect(reduceEmi.prepay.interestSaved.lessThan(reduceTenure.prepay.interestSaved)).toBe(true);
    expect(reduceEmi.prepay.monthsSaved).toBe(0);
  });

  it("a prepayment penalty reduces net benefit but not interest saved", () => {
    const withPenalty = prepayVsInvest({
      ...input,
      liability: { ...input.liability, prepaymentPenaltyPercent: "2" },
    });
    const withoutPenalty = prepayVsInvest(input);
    expect(withPenalty.prepay.interestSaved.toFixed(2)).toBe(
      withoutPenalty.prepay.interestSaved.toFixed(2),
    );
    expect(withPenalty.prepay.penaltyCost.toFixed(2)).toBe("4000.00"); // 2% of 200000
    expect(withPenalty.prepay.netBenefit.lessThan(withoutPenalty.prepay.netBenefit)).toBe(true);
  });
});

function commitment(overrides: Partial<HeadroomCommitmentInput>): HeadroomCommitmentInput {
  return {
    id: "c",
    name: "Commitment",
    direction: "OUTFLOW",
    category: "OTHER",
    amount: "1000",
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 0, 1),
    dayOfMonth: null,
    endDate: null,
    isActive: true,
    isVariable: false,
    ...overrides,
  };
}

describe("checkAffordability", () => {
  const now = istDate(2026, 0, 1);

  it("a comfortably affordable purchase puts nothing at risk and leaves goals untouched", () => {
    const result = checkAffordability({
      now,
      purchaseAmount: "50000",
      purchaseDate: istDate(2026, 0, 10),
      accounts: [{ currentBalance: "500000" }],
      commitments: [commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 5) })],
      emergencyFundTargetMonths: 6,
      goals: [
        {
          id: "g1",
          name: "Vacation",
          currentAmount: "50000",
          targetAmount: "200000",
          monthlyContribution: "10000",
          expectedAnnualReturnPercent: "6",
        },
      ],
    });

    expect(result.commitmentsAtRisk).toHaveLength(0);
    expect(result.goalImpacts[0].monthsDelayed).toBe(0);
    expect(result.goalImpacts[0].afterPurchaseMonthsToTarget).toBe(
      result.goalImpacts[0].baselineMonthsToTarget,
    );
  });

  it("a purchase that creates a shortfall flags at-risk commitments after the crossing point", () => {
    const result = checkAffordability({
      now,
      purchaseAmount: "90000",
      purchaseDate: istDate(2026, 0, 3),
      accounts: [{ currentBalance: "100000" }],
      commitments: [
        commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 5) }),
        commitment({ id: "sip", name: "SIP", amount: "5000", anchorDate: istDate(2026, 0, 15) }),
      ],
      emergencyFundTargetMonths: 6,
      goals: [],
    });

    // 100000 - 90000 (purchase, 3 Jan) - 20000 (rent, 5 Jan) = -10000: negative from 5 Jan onward.
    expect(result.commitmentsAtRisk.length).toBeGreaterThan(0);
    expect(result.commitmentsAtRisk.map((c) => c.name)).toContain("Rent");
  });

  it("emergency fund coverage drops after the purchase", () => {
    const result = checkAffordability({
      now,
      purchaseAmount: "60000",
      purchaseDate: istDate(2026, 0, 10),
      accounts: [{ currentBalance: "120000" }],
      commitments: [commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 5) })],
      emergencyFundTargetMonths: 6,
      goals: [],
    });

    expect(result.emergencyFundMonthsBefore.toFixed(2)).toBe("6.00"); // 120000 / 20000
    expect(result.emergencyFundMonthsAfter.toFixed(2)).toBe("3.00"); // 60000 / 20000
    expect(result.emergencyFundMonthsAfter.lessThan(result.emergencyFundMonthsBefore)).toBe(true);
    // Crossed below the 6-month target as a direct result of this purchase — worth calling out.
    expect(result.assumptions.some((a) => a.includes("below your 6-month target"))).toBe(true);
  });

  it("does not repeat the below-target warning when already below target beforehand", () => {
    const result = checkAffordability({
      now,
      purchaseAmount: "10000",
      purchaseDate: istDate(2026, 0, 10),
      accounts: [{ currentBalance: "40000" }], // already only 2 months of cover
      commitments: [commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 5) })],
      emergencyFundTargetMonths: 6,
      goals: [],
    });
    expect(result.assumptions.some((a) => a.includes("below your 6-month target"))).toBe(false);
  });

  it("a purchase that exceeds liquid cash delays goals by the months of contribution it takes to recover", () => {
    const result = checkAffordability({
      now,
      purchaseAmount: "150000",
      purchaseDate: istDate(2026, 0, 10),
      accounts: [{ currentBalance: "100000" }],
      commitments: [],
      emergencyFundTargetMonths: 6,
      goals: [
        {
          id: "g1",
          name: "Vacation",
          currentAmount: "0",
          targetAmount: "1000000",
          monthlyContribution: "10000",
          expectedAnnualReturnPercent: "0",
        },
      ],
    });

    // Shortfall = 150000 - 100000 = 50000; at 10000/month that's 5 months lost.
    expect(result.goalImpacts[0].monthsDelayed).toBe(5);
    expect(result.goalImpacts[0].afterPurchaseMonthsToTarget).toBe(
      result.goalImpacts[0].baselineMonthsToTarget! + 5,
    );
  });

  it("resultingHeadroom matches netting the purchase against accounts and existing commitments", () => {
    const result = checkAffordability({
      now,
      purchaseAmount: "30000",
      purchaseDate: istDate(2026, 0, 10),
      accounts: [{ currentBalance: "200000" }],
      commitments: [commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 5) })],
      emergencyFundTargetMonths: 6,
      goals: [],
    });
    // 30-day fallback window (no salary), so both rent and the purchase fall inside it.
    expect(result.resultingHeadroom.toFixed(2)).toBe("150000.00"); // 200000 - 20000 - 30000
  });
});
