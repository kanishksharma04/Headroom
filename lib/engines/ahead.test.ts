import { describe, expect, it } from "vitest";
import {
  groupByWeek,
  isDormant,
  projectCashFlow,
  summariseRecurringCommitments,
} from "@/lib/engines/ahead";
import { calculateHeadroom } from "@/lib/engines/headroom";
import type { CommitmentForOccurrences } from "@/lib/engines/commitments";
import { istDate } from "@/lib/dates";

function commitment(overrides: Partial<CommitmentForOccurrences>): CommitmentForOccurrences {
  return {
    id: "c",
    name: "Commitment",
    direction: "OUTFLOW",
    amount: "1000",
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 0, 1),
    dayOfMonth: null,
    endDate: null,
    isActive: true,
    ...overrides,
  };
}

describe("projectCashFlow", () => {
  it("renders 90 days accurately from seeded commitments", () => {
    const now = istDate(2026, 0, 1);
    const result = projectCashFlow({
      now,
      horizonDays: 90,
      accounts: [{ currentBalance: "100000" }],
      commitments: [
        commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 1) }),
        commitment({
          id: "sip",
          name: "SIP",
          amount: "10000",
          anchorDate: istDate(2026, 0, 5),
        }),
      ],
    });

    expect(result.horizonDays).toBe(90);
    expect(result.startBalance.toFixed(2)).toBe("100000.00");
    // 90 days from 1 Jan lands exactly on 1 Apr (inclusive), so the
    // 1st-of-month rent occurs 4 times (1 Jan/Feb/Mar/Apr); the 5th-of-month
    // SIP occurs 3 times (5 Jan/Feb/Mar — 5 Apr falls just outside).
    expect(result.points.filter((p) => p.sourceId === "rent")).toHaveLength(4);
    expect(result.points.filter((p) => p.sourceId === "sip")).toHaveLength(3);
    // Points are chronological.
    for (let i = 1; i < result.points.length; i++) {
      expect(result.points[i].date.getTime()).toBeGreaterThanOrEqual(result.points[i - 1].date.getTime());
    }
  });

  it("includes salary normally, unlike the Headroom engine which excludes it", () => {
    const now = istDate(2026, 0, 1);
    const result = projectCashFlow({
      now,
      horizonDays: 30,
      accounts: [{ currentBalance: "0" }],
      commitments: [
        commitment({
          id: "salary",
          name: "Salary",
          direction: "INFLOW",
          amount: "50000",
          anchorDate: istDate(2026, 0, 25),
        }),
      ],
    });
    expect(result.points).toHaveLength(1);
    expect(result.points[0].amount.toFixed(2)).toBe("50000.00");
    expect(result.endBalance.toFixed(2)).toBe("50000.00");
  });

  it("marks a negative crossing unmistakably, at the first point it occurs", () => {
    const now = istDate(2026, 0, 1);
    const result = projectCashFlow({
      now,
      horizonDays: 30,
      accounts: [{ currentBalance: "10000" }],
      commitments: [
        commitment({ id: "bill-1", name: "Bill 1", amount: "6000", anchorDate: istDate(2026, 0, 5) }),
        commitment({ id: "bill-2", name: "Bill 2", amount: "6000", anchorDate: istDate(2026, 0, 10) }),
      ],
    });

    expect(result.goesNegative).toBe(true);
    expect(result.firstNegativeDate?.getTime()).toBe(istDate(2026, 0, 10).getTime());
    // Not the first bill (10000 - 6000 = 4000, still positive).
    expect(result.points[0].runningBalance.isNegative()).toBe(false);
    expect(result.points[1].runningBalance.toFixed(2)).toBe("-2000.00");
  });

  it("reports no negative crossing when the balance stays positive throughout", () => {
    const now = istDate(2026, 0, 1);
    const result = projectCashFlow({
      now,
      horizonDays: 30,
      accounts: [{ currentBalance: "100000" }],
      commitments: [commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 5) })],
    });
    expect(result.goesNegative).toBe(false);
    expect(result.firstNegativeDate).toBeNull();
  });

  it("agrees with the Headroom engine's sign convention and totals over the same span", () => {
    // Same accounts and non-salary commitments fed to both engines, over a
    // span with no salary commitment (so Headroom has nothing special to
    // exclude) — the two engines' totals must agree exactly.
    const now = istDate(2026, 0, 1);
    const accounts = [{ id: "acc-1", name: "Bank", currentBalance: "50000" }];
    const commitments = [
      commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 5) }),
      commitment({ id: "sip", name: "SIP", amount: "5000", anchorDate: istDate(2026, 0, 10) }),
    ];

    const headroom = calculateHeadroom({
      now,
      accounts,
      commitments: commitments.map((c) => ({ ...c, category: "OTHER", isVariable: false })),
      variableSpendBaseline: null,
    });

    const projection = projectCashFlow({
      now,
      horizonDays: 30,
      accounts,
      commitments,
    });

    expect(projection.endBalance.toFixed(2)).toBe(headroom.amount.toFixed(2));
  });
});

describe("groupByWeek", () => {
  it("buckets points into Monday-start weeks in chronological order", () => {
    const now = istDate(2026, 0, 1);
    const result = projectCashFlow({
      now,
      horizonDays: 30,
      accounts: [{ currentBalance: "0" }],
      commitments: [
        commitment({ id: "a", name: "A", anchorDate: istDate(2026, 0, 2) }), // Fri
        commitment({ id: "b", name: "B", anchorDate: istDate(2026, 0, 9) }), // Fri, next week
      ],
    });

    const grouped = groupByWeek(result.points);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].points).toHaveLength(1);
    expect(grouped[1].points).toHaveLength(1);
    expect(grouped[0].weekStart.getTime()).toBeLessThan(grouped[1].weekStart.getTime());
  });
});

describe("summariseRecurringCommitments", () => {
  it("computes monthly and annual totals across mixed frequencies, outflows only", () => {
    const summary = summariseRecurringCommitments([
      commitment({ id: "rent", amount: "20000", frequency: "MONTHLY" }),
      commitment({ id: "insurance", amount: "6000", frequency: "QUARTERLY" }),
      commitment({ id: "car-insurance", amount: "18000", frequency: "ANNUAL" }),
      commitment({ id: "salary", amount: "80000", frequency: "MONTHLY", direction: "INFLOW" }),
      commitment({ id: "one-off", amount: "5000", frequency: "ONE_TIME" }),
    ]);

    // Annual: rent 20000*12=240000, insurance 6000*4=24000, car 18000*1=18000 = 282000
    expect(summary.annualOutflowTotal.toFixed(2)).toBe("282000.00");
    expect(summary.monthlyOutflowTotal.toFixed(2)).toBe((282000 / 12).toFixed(2));
  });

  it("excludes inactive commitments", () => {
    const summary = summariseRecurringCommitments([
      commitment({ id: "rent", amount: "20000", frequency: "MONTHLY", isActive: false }),
    ]);
    expect(summary.annualOutflowTotal.toFixed(2)).toBe("0.00");
  });
});

describe("isDormant", () => {
  it("flags a monthly commitment not updated in three cycles (90+ days)", () => {
    const now = istDate(2026, 3, 1);
    expect(
      isDormant({ frequency: "MONTHLY", isActive: true, updatedAt: istDate(2026, 0, 1) }, now),
    ).toBe(true);
  });

  it("does not flag a recently updated commitment", () => {
    const now = istDate(2026, 3, 1);
    expect(
      isDormant({ frequency: "MONTHLY", isActive: true, updatedAt: istDate(2026, 2, 15) }, now),
    ).toBe(false);
  });

  it("never flags a one-time commitment", () => {
    const now = istDate(2027, 0, 1);
    expect(
      isDormant({ frequency: "ONE_TIME", isActive: true, updatedAt: istDate(2020, 0, 1) }, now),
    ).toBe(false);
  });

  it("never flags an inactive commitment (it's already been turned off deliberately)", () => {
    const now = istDate(2027, 0, 1);
    expect(
      isDormant({ frequency: "MONTHLY", isActive: false, updatedAt: istDate(2020, 0, 1) }, now),
    ).toBe(false);
  });
});
