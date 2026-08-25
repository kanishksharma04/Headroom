import { describe, expect, it } from "vitest";
import {
  assessLifeInsuranceAdequacy,
  checkAffordability,
  compareRefinance,
  deriveRemainingScheduleParams,
  incomeChangeImpact,
  jobLossRunway,
  prepayVsInvest,
  projectedInvestmentValue,
} from "@/lib/engines/decisions";
import { calculateEmi, generateAmortisationSchedule } from "@/lib/engines/amortisation";
import type { HeadroomCommitmentInput } from "@/lib/engines/headroom";
import { getIstParts, istDate } from "@/lib/dates";

describe("deriveRemainingScheduleParams", () => {
  it("counts the full remaining tenure when now is right at the start", () => {
    const params = deriveRemainingScheduleParams(
      { emiAmount: "34966.51", emiDayOfMonth: 5, startDate: istDate(2026, 7, 15), tenureMonths: 240 },
      istDate(2026, 7, 15), // same day as the loan started, before the first EMI (5 Aug already passed if start is 15 Aug — first EMI anchors to 5 Aug per deriveEmiCommitmentFields)
    );
    // The anchor month is August 2026 itself (day 5), which is before the
    // 15 Aug "now" — so the Aug EMI has already happened; 239 remain.
    expect(params.remainingTenureMonths).toBe(239);
    expect(getIstParts(params.firstDueDate)).toMatchObject({ year: 2026, month: 8, day: 5 });
  });

  it("counts down correctly partway through a loan", () => {
    const params = deriveRemainingScheduleParams(
      { emiAmount: "10000", emiDayOfMonth: 5, startDate: istDate(2024, 0, 5), tenureMonths: 60 },
      istDate(2026, 0, 6), // the day after January 2026's EMI (the 25th of 60)
    );
    // 25 EMIs (Jan 2024 through Jan 2026 inclusive) have already fallen due; 35 remain.
    expect(params.remainingTenureMonths).toBe(35);
    expect(getIstParts(params.firstDueDate)).toMatchObject({ year: 2026, month: 1, day: 5 });
  });

  it("includes this month's EMI when it hasn't happened yet", () => {
    const params = deriveRemainingScheduleParams(
      { emiAmount: "10000", emiDayOfMonth: 5, startDate: istDate(2024, 0, 5), tenureMonths: 60 },
      istDate(2026, 0, 1), // before this month's 5th
    );
    expect(getIstParts(params.firstDueDate)).toMatchObject({ year: 2026, month: 0, day: 5 });
    expect(params.remainingTenureMonths).toBe(36); // Jan 2026 through Dec 2028
  });

  it("throws once the loan's original tenure has fully elapsed", () => {
    expect(() =>
      deriveRemainingScheduleParams(
        { emiAmount: "10000", emiDayOfMonth: 5, startDate: istDate(2020, 0, 5), tenureMonths: 12 },
        istDate(2026, 0, 1),
      ),
    ).toThrow();
  });
});

describe("projectedInvestmentValue", () => {
  it("compounds a lump sum at a fixed annual rate over a fractional-year term", () => {
    // 200000 * 1.12^(208/12) — matches the BASE scenario in prepayVsInvest exactly.
    expect(projectedInvestmentValue("200000", "12", 208).toFixed(2)).toBe("1426075.07");
  });

  it("is the identity at zero months", () => {
    expect(projectedInvestmentValue("50000", "10", 0).toFixed(2)).toBe("50000.00");
  });

  it("matches simple principal at 0% return", () => {
    expect(projectedInvestmentValue("50000", "0", 60).toFixed(2)).toBe("50000.00");
  });
});

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

describe("incomeChangeImpact", () => {
  const now = istDate(2026, 0, 1);
  const salary = commitment({
    id: "salary",
    name: "Salary",
    direction: "INFLOW",
    category: "SALARY",
    amount: "50000",
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 0, 15),
    dayOfMonth: 15,
  });

  it("throws when there is no salary commitment to scale", () => {
    expect(() =>
      incomeChangeImpact({
        now,
        accounts: [{ currentBalance: "0" }],
        commitments: [commitment({ id: "rent", name: "Rent" })],
        newMonthlySalary: "60000",
      }),
    ).toThrow();
  });

  it("scales a single salary commitment and the change shows up in the 90-day projection, not the Headroom window", () => {
    const result = incomeChangeImpact({
      now,
      accounts: [{ currentBalance: "0" }],
      commitments: [salary],
      newMonthlySalary: "60000",
    });

    expect(result.currentMonthlySalary.toFixed(2)).toBe("50000.00");
    expect(result.newMonthlySalary.toFixed(2)).toBe("60000.00");
    expect(result.monthlySalaryDelta.toFixed(2)).toBe("10000.00");

    // 90 days from 1 Jan reaches 1 Apr; the 15th-of-month salary lands
    // 15 Jan / 15 Feb / 15 Mar — three times, 15 Apr falls just outside.
    expect(result.projectionBefore.endBalance.toFixed(2)).toBe("150000.00"); // 50000 * 3
    expect(result.projectionAfter.endBalance.toFixed(2)).toBe("180000.00"); // 60000 * 3
    expect(result.projectedEndBalanceDelta.toFixed(2)).toBe("30000.00"); // (60000-50000) * 3
  });

  it("preserves the relative split across multiple salary commitments when scaling", () => {
    const salaryA = commitment({
      id: "salary-a",
      name: "Salary A",
      direction: "INFLOW",
      category: "SALARY",
      amount: "30000",
      anchorDate: istDate(2026, 0, 15),
      dayOfMonth: 15,
    });
    const salaryB = commitment({
      id: "salary-b",
      name: "Salary B",
      direction: "INFLOW",
      category: "SALARY",
      amount: "20000",
      anchorDate: istDate(2026, 0, 15),
      dayOfMonth: 15,
    });

    const result = incomeChangeImpact({
      now,
      accounts: [{ currentBalance: "0" }],
      commitments: [salaryA, salaryB],
      newMonthlySalary: "100000", // 2x the combined 50000
    });

    expect(result.currentMonthlySalary.toFixed(2)).toBe("50000.00");
    // Each salary line doubles, so one 90-day cycle nets 100000 vs the original 50000.
    expect(result.projectionAfter.endBalance.toFixed(2)).toBe("300000.00"); // 100000 * 3
  });
});

describe("jobLossRunway", () => {
  const now = istDate(2026, 0, 1);

  it("depletes purely from the variable-spend estimate when no commitments intervene", () => {
    const result = jobLossRunway({
      now,
      accounts: [{ currentBalance: "30000" }],
      commitments: [],
      variableSpendBaseline: { monthlyAmount: "30000" }, // 1000/day
      emergencyFundTargetMonths: 6,
    });
    expect(result.runwayDays).toBe(30);
    expect(getIstParts(result.depletionDate!)).toMatchObject({ year: 2026, month: 0, day: 31 });
  });

  it("depletes exactly at a commitment's due date when that's what pushes the balance negative", () => {
    const result = jobLossRunway({
      now,
      accounts: [{ currentBalance: "50000" }],
      commitments: [
        commitment({
          id: "big-outflow",
          name: "Insurance premium",
          direction: "OUTFLOW",
          frequency: "ONE_TIME",
          amount: "60000",
          anchorDate: istDate(2026, 0, 16),
        }),
      ],
      variableSpendBaseline: null,
      emergencyFundTargetMonths: 6,
    });
    expect(result.runwayDays).toBe(15);
    expect(getIstParts(result.depletionDate!)).toMatchObject({ year: 2026, month: 0, day: 16 });
  });

  it("excludes the SALARY inflow from the projection, unlike every other commitment", () => {
    const result = jobLossRunway({
      now,
      accounts: [{ currentBalance: "15000" }],
      commitments: [
        commitment({
          id: "salary",
          name: "Salary",
          direction: "INFLOW",
          category: "SALARY",
          amount: "50000",
          frequency: "ONE_TIME",
          anchorDate: istDate(2026, 0, 4),
        }),
        commitment({
          id: "rent",
          name: "Rent",
          direction: "OUTFLOW",
          frequency: "ONE_TIME",
          amount: "20000",
          anchorDate: istDate(2026, 0, 11),
        }),
      ],
      variableSpendBaseline: null,
      emergencyFundTargetMonths: 6,
    });
    // If salary were wrongly included, the balance would be 65000 by day 4
    // and rent on day 11 would never push it negative.
    expect(result.runwayDays).toBe(10);
  });

  it("reports no depletion date when the balance stays positive through the horizon", () => {
    const result = jobLossRunway({
      now,
      accounts: [{ currentBalance: "10000000" }],
      commitments: [],
      variableSpendBaseline: null,
      emergencyFundTargetMonths: 6,
    });
    expect(result.runwayDays).toBeNull();
    expect(result.depletionDate).toBeNull();
  });

  it("computes emergency fund coverage from recurring outflows alone, independent of the depletion date", () => {
    const result = jobLossRunway({
      now,
      accounts: [{ currentBalance: "120000" }],
      commitments: [
        commitment({ id: "rent", name: "Rent", direction: "OUTFLOW", frequency: "MONTHLY", amount: "20000" }),
      ],
      variableSpendBaseline: null,
      emergencyFundTargetMonths: 6,
    });
    expect(result.emergencyFundCoverageMonths.toFixed(2)).toBe("6.00");
    expect(result.meetsEmergencyFundTarget).toBe(true);

    const shortOfTarget = jobLossRunway({
      now,
      accounts: [{ currentBalance: "120000" }],
      commitments: [
        commitment({ id: "rent", name: "Rent", direction: "OUTFLOW", frequency: "MONTHLY", amount: "20000" }),
      ],
      variableSpendBaseline: null,
      emergencyFundTargetMonths: 8,
    });
    expect(shortOfTarget.meetsEmergencyFundTarget).toBe(false);
  });

  it("floors emergency fund coverage at zero months rather than going negative when accounts are overdrawn", () => {
    const result = jobLossRunway({
      now,
      accounts: [{ currentBalance: "-5000" }],
      commitments: [
        commitment({ id: "rent", name: "Rent", direction: "OUTFLOW", frequency: "MONTHLY", amount: "20000" }),
      ],
      variableSpendBaseline: null,
      emergencyFundTargetMonths: 6,
    });
    expect(result.emergencyFundCoverageMonths.toFixed(2)).toBe("0.00");
    expect(result.meetsEmergencyFundTarget).toBe(false);
  });
});

describe("compareRefinance", () => {
  const liability = {
    outstandingPrincipal: "1000000",
    annualRatePercent: "9",
    remainingTenureMonths: 60,
    firstDueDate: istDate(2026, 0, 5),
    isSelfOccupied: true,
  };
  const input = {
    liability,
    newAnnualRatePercent: "8",
    newLoanProcessingFeePercent: "0.5",
    taxProfile: { regime: "OLD" as const, taxSlabPercent: "30" },
  };

  it("EMI and total interest for both branches match the amortisation engine directly", () => {
    const result = compareRefinance(input);

    expect(result.currentEmi.toFixed(2)).toBe(
      calculateEmi(liability.outstandingPrincipal, liability.annualRatePercent, liability.remainingTenureMonths).toFixed(2),
    );
    expect(result.newEmi.toFixed(2)).toBe(
      calculateEmi(liability.outstandingPrincipal, input.newAnnualRatePercent, liability.remainingTenureMonths).toFixed(2),
    );

    const currentSchedule = generateAmortisationSchedule({
      principal: liability.outstandingPrincipal,
      annualRatePercent: liability.annualRatePercent,
      tenureMonths: liability.remainingTenureMonths,
      firstDueDate: liability.firstDueDate,
    });
    const newSchedule = generateAmortisationSchedule({
      principal: liability.outstandingPrincipal,
      annualRatePercent: input.newAnnualRatePercent,
      tenureMonths: liability.remainingTenureMonths,
      firstDueDate: liability.firstDueDate,
    });
    expect(result.currentTotalInterest.toFixed(2)).toBe(currentSchedule.totalInterest.toFixed(2));
    expect(result.newTotalInterest.toFixed(2)).toBe(newSchedule.totalInterest.toFixed(2));
    expect(result.interestSaved.toFixed(2)).toBe(
      currentSchedule.totalInterest.minus(newSchedule.totalInterest).toFixed(2),
    );
  });

  it("a genuinely lower rate produces positive interest and EMI savings", () => {
    const result = compareRefinance(input);
    expect(result.interestSaved.greaterThan(0)).toBe(true);
    expect(result.emiDelta.greaterThan(0)).toBe(true);
    expect(result.currentEmi.greaterThan(result.newEmi)).toBe(true);
  });

  it("switching costs are exact percentages of the outstanding principal — ₹10L at 2% + 0.5%", () => {
    const result = compareRefinance({
      ...input,
      liability: { ...liability, prepaymentPenaltyPercent: "2" },
    });
    expect(result.foreclosurePenalty.toFixed(2)).toBe("20000.00");
    expect(result.processingFee.toFixed(2)).toBe("5000.00");
    expect(result.switchingCosts.toFixed(2)).toBe("25000.00");
  });

  it("no prepaymentPenaltyPercent on the liability means zero foreclosure penalty", () => {
    const result = compareRefinance(input);
    expect(result.foreclosurePenalty.toFixed(2)).toBe("0.00");
    expect(result.switchingCosts.toFixed(2)).toBe(result.processingFee.toFixed(2));
  });

  it("net benefit is exactly interestSaved minus switchingCosts minus lostDeductionValue", () => {
    const result = compareRefinance({
      ...input,
      liability: { ...liability, prepaymentPenaltyPercent: "1" },
    });
    const expectedNet = result.interestSaved.minus(result.switchingCosts).minus(result.lostDeductionValue);
    expect(result.netBenefit.toFixed(2)).toBe(expectedNet.toFixed(2));
  });

  it("break-even months is the ceiling of switchingCosts / emiDelta", () => {
    const result = compareRefinance({
      ...input,
      liability: { ...liability, prepaymentPenaltyPercent: "1" },
    });
    expect(result.breakEvenMonths).toBe(Math.ceil(result.switchingCosts.div(result.emiDelta).toNumber()));
  });

  it("break-even is null when the new rate isn't actually better", () => {
    const result = compareRefinance({ ...input, newAnnualRatePercent: "9.5" });
    expect(result.emiDelta.greaterThan(0)).toBe(false);
    expect(result.breakEvenMonths).toBeNull();
    expect(result.interestSaved.lessThan(0)).toBe(true);
  });

  it("under the New regime, there is no lost Section 24(b) deduction", () => {
    const result = compareRefinance({
      ...input,
      taxProfile: { regime: "NEW", taxSlabPercent: "30" },
    });
    expect(result.lostDeductionValue.toFixed(2)).toBe("0.00");
  });

  it("under the Old regime, a real interest reduction produces a nonzero lost deduction", () => {
    const result = compareRefinance(input);
    expect(result.lostDeductionValue.greaterThan(0)).toBe(true);
  });
});

describe("assessLifeInsuranceAdequacy", () => {
  const salaryCommitment = commitment({
    id: "salary",
    name: "Salary",
    direction: "INFLOW",
    category: "SALARY",
    amount: "100000",
    frequency: "MONTHLY",
  });

  it("required cover is exactly 10 years of income plus debt plus goal shortfalls", () => {
    const result = assessLifeInsuranceAdequacy({
      commitments: [salaryCommitment],
      outstandingDebt: "2000000",
      totalAssets: "1000000",
      goalShortfallTotal: "500000",
      existingCoverage: "5000000",
    });

    expect(result.currentMonthlyIncome.toFixed(2)).toBe("100000.00");
    expect(result.incomeReplacementValue.toFixed(2)).toBe("12000000.00"); // 100000 * 12 * 10
    expect(result.debtCoverage.toFixed(2)).toBe("2000000.00");
    expect(result.goalCoverage.toFixed(2)).toBe("500000.00");
    expect(result.requiredCover.toFixed(2)).toBe("14500000.00");
    expect(result.availableResources.toFixed(2)).toBe("6000000.00"); // 5000000 + 1000000
    // Signed availableResources - requiredCover, so a real shortfall is negative.
    expect(result.netPosition.toFixed(2)).toBe("-8500000.00"); // 6000000 - 14500000
  });

  it("reports a positive net position — a surplus — when existing resources already exceed what's required", () => {
    const result = assessLifeInsuranceAdequacy({
      commitments: [salaryCommitment],
      outstandingDebt: "0",
      totalAssets: "0",
      goalShortfallTotal: "0",
      existingCoverage: "20000000",
    });
    expect(result.netPosition.greaterThan(0)).toBe(true);
  });

  it("honours a custom income-replacement multiple instead of the 10-year default", () => {
    const result = assessLifeInsuranceAdequacy({
      commitments: [salaryCommitment],
      outstandingDebt: "0",
      totalAssets: "0",
      goalShortfallTotal: "0",
      existingCoverage: "0",
      incomeReplacementYears: 5,
    });
    expect(result.incomeReplacementValue.toFixed(2)).toBe("6000000.00"); // 100000 * 12 * 5
  });

  it("sums more than one active salary commitment", () => {
    const result = assessLifeInsuranceAdequacy({
      commitments: [
        salaryCommitment,
        commitment({ id: "freelance", name: "Freelance", direction: "INFLOW", category: "SALARY", amount: "20000" }),
      ],
      outstandingDebt: "0",
      totalAssets: "0",
      goalShortfallTotal: "0",
      existingCoverage: "0",
    });
    expect(result.currentMonthlyIncome.toFixed(2)).toBe("120000.00");
  });

  it("ignores an inactive salary commitment", () => {
    const result = assessLifeInsuranceAdequacy({
      commitments: [salaryCommitment, commitment({ id: "old-job", direction: "INFLOW", category: "SALARY", amount: "50000", isActive: false })],
      outstandingDebt: "0",
      totalAssets: "0",
      goalShortfallTotal: "0",
      existingCoverage: "0",
    });
    expect(result.currentMonthlyIncome.toFixed(2)).toBe("100000.00");
  });

  it("throws a helpful error when there's no salary commitment to base income replacement on", () => {
    expect(() =>
      assessLifeInsuranceAdequacy({
        commitments: [],
        outstandingDebt: "0",
        totalAssets: "0",
        goalShortfallTotal: "0",
        existingCoverage: "0",
      }),
    ).toThrow(/salary commitment/i);
  });
});
