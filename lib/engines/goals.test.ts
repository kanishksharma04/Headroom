import { describe, expect, it } from "vitest";
import {
  evaluateGoal,
  monthsUntil,
  projectGoalAmount,
  requiredMonthlyContribution,
  monthsToReachTarget,
  type GoalInput,
} from "@/lib/engines/goals";
import { istDate } from "@/lib/dates";

describe("monthsUntil", () => {
  it("counts whole calendar months, floored to the day", () => {
    expect(monthsUntil(istDate(2026, 0, 15), istDate(2027, 0, 15))).toBe(12);
    expect(monthsUntil(istDate(2026, 0, 15), istDate(2027, 0, 14))).toBe(11); // one day short of a full year
  });

  it("never goes negative for a target date in the past", () => {
    expect(monthsUntil(istDate(2026, 5, 1), istDate(2026, 0, 1))).toBe(0);
  });

  it("is zero for the same day", () => {
    expect(monthsUntil(istDate(2026, 5, 1), istDate(2026, 5, 1))).toBe(0);
  });
});

describe("projectGoalAmount", () => {
  it("is the identity at zero months", () => {
    expect(projectGoalAmount("200000", "10000", "10", 0).toFixed(2)).toBe("200000.00");
  });

  it("is simple addition with no compounding at 0% return", () => {
    // 200000 + 10000*12 = 320000
    expect(projectGoalAmount("200000", "10000", "0", 12).toFixed(2)).toBe("320000.00");
  });

  it("matches a hand-computed 3-month walk of the same recursion (balance*(1+r) + contribution)", () => {
    // r = 12%/12/100 = 0.01/month. Start 100000, contribute 5000/month.
    // m1: 100000*1.01 + 5000 = 106000.00
    // m2: 106000*1.01 + 5000 = 112060.00
    // m3: 112060*1.01 + 5000 = 118180.60
    expect(projectGoalAmount("100000", "5000", "12", 3).toFixed(2)).toBe("118180.60");
  });
});

describe("requiredMonthlyContribution", () => {
  it("is the inverse of projectGoalAmount: feeding its own output back in reproduces the contribution", () => {
    const projected = projectGoalAmount("100000", "7500", "9", 24);
    const required = requiredMonthlyContribution("100000", projected, "9", 24);
    expect(required.toFixed(2)).toBe("7500.00");
  });

  it("is zero once the target is already met", () => {
    expect(requiredMonthlyContribution("500000", "400000", "8", 12).toFixed(2)).toBe("0.00");
  });

  it("divides the shortfall evenly across the months at 0% return", () => {
    // (300000 - 100000) / 20 months = 10000/month
    expect(requiredMonthlyContribution("100000", "300000", "0", 20).toFixed(2)).toBe("10000.00");
  });

  it("returns the full remaining gap when there are no months left", () => {
    expect(requiredMonthlyContribution("100000", "300000", "8", 0).toFixed(2)).toBe("200000.00");
  });
});

describe("monthsToReachTarget", () => {
  it("is zero when the target is already met", () => {
    expect(monthsToReachTarget("500000", "400000", "10000", "8")).toBe(0);
  });

  it("matches the required-contribution/projection round trip for a solvable target", () => {
    const months = monthsToReachTarget("100000", "300000", "10000", "6");
    expect(months).not.toBeNull();
    // One month earlier must fall short, this month must clear it.
    const target = 300000;
    expect(projectGoalAmount("100000", "10000", "6", months! - 1).lessThan(target)).toBe(true);
    expect(projectGoalAmount("100000", "10000", "6", months!).greaterThanOrEqualTo(target)).toBe(true);
  });

  it("returns null when the goal is unreachable within 100 years", () => {
    expect(monthsToReachTarget("0", "100000000", "1", "0")).toBeNull();
  });
});

function goal(overrides: Partial<GoalInput>): GoalInput {
  return {
    currentAmount: "200000",
    targetAmount: "2500000",
    monthlyContribution: "12000",
    expectedAnnualReturnPercent: "10",
    inflationPercent: "6",
    targetDate: istDate(2036, 6, 1),
    ...overrides,
  };
}

describe("evaluateGoal", () => {
  it("is ON_TRACK when the projected amount already clears the inflation-adjusted target", () => {
    const now = istDate(2026, 6, 1);
    const result = evaluateGoal(
      goal({ currentAmount: "5000000", targetAmount: "1000000", monthlyContribution: "0", inflationPercent: "0" }),
      now,
    );
    expect(result.status).toBe("ON_TRACK");
    expect(result.shortfallAtTargetDate.toFixed(2)).toBe("0.00");
    expect(result.progressPercent.toFixed(2)).toBe("100.00");
  });

  it("is OFF_TRACK when current pace falls well short of the inflation-adjusted target", () => {
    const now = istDate(2026, 6, 1);
    const result = evaluateGoal(
      goal({
        currentAmount: "0",
        targetAmount: "10000000",
        monthlyContribution: "100",
        expectedAnnualReturnPercent: "5",
        targetDate: istDate(2027, 6, 1), // 12 months out
      }),
      now,
    );
    expect(result.status).toBe("OFF_TRACK");
    expect(result.shortfallAtTargetDate.greaterThan(0)).toBe(true);
  });

  it("inflates the target forward at the goal's own inflation rate over the remaining years", () => {
    const now = istDate(2026, 6, 1);
    const result = evaluateGoal(
      goal({ targetAmount: "1000000", inflationPercent: "6", targetDate: istDate(2027, 6, 1) }),
      now,
    );
    // 1 year out at 6%: 1000000 * 1.06
    expect(result.inflationAdjustedTarget.toFixed(2)).toBe("1060000.00");
  });

  it("requiredMonthlyContribution is zero once the goal is already ON_TRACK", () => {
    const now = istDate(2026, 6, 1);
    const result = evaluateGoal(
      goal({ currentAmount: "5000000", targetAmount: "1000000", inflationPercent: "0", monthlyContribution: "0" }),
      now,
    );
    expect(result.requiredMonthlyContribution.toFixed(2)).toBe("0.00");
  });

  it("progressPercent is clamped to 100 even when already well past the target", () => {
    const now = istDate(2026, 6, 1);
    const result = evaluateGoal(
      goal({ currentAmount: "9000000", targetAmount: "1000000", inflationPercent: "0", monthlyContribution: "0" }),
      now,
    );
    expect(result.progressPercent.toFixed(2)).toBe("100.00");
  });

  it("monthsRemaining is zero once the target date has passed, and status still resolves", () => {
    const now = istDate(2026, 6, 1);
    const result = evaluateGoal(goal({ targetDate: istDate(2020, 0, 1), currentAmount: "100" }), now);
    expect(result.monthsRemaining).toBe(0);
  });
});
