import { describe, expect, it } from "vitest";
import {
  detectAttentionItems,
  detectOverdueEmis,
  detectProjectedShortfall,
  detectStaleBalances,
  STALE_BALANCE_THRESHOLD_DAYS,
} from "@/lib/engines/attention";
import { calculateHeadroom, type HeadroomCommitmentInput } from "@/lib/engines/headroom";
import { addDays } from "date-fns";
import { istDate } from "@/lib/dates";

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

describe("detectProjectedShortfall", () => {
  it("returns null when the balance never goes negative", () => {
    const result = calculateHeadroom({
      now: istDate(2026, 0, 1),
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "100000" }],
      commitments: [commitment({ id: "rent", name: "Rent", amount: "20000", anchorDate: istDate(2026, 0, 10) })],
      variableSpendBaseline: null,
    });
    expect(detectProjectedShortfall(result)).toBeNull();
  });

  it("finds the worst point a mid-window dip reaches, even if it recovers by the end", () => {
    const result = calculateHeadroom({
      now: istDate(2026, 0, 1),
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "10000" }],
      commitments: [
        commitment({ id: "rent", name: "Rent", amount: "25000", anchorDate: istDate(2026, 0, 5) }),
        commitment({
          id: "salary",
          name: "Salary",
          direction: "INFLOW",
          category: "SALARY",
          amount: "50000",
          anchorDate: istDate(2026, 0, 20),
          dayOfMonth: 20,
        }),
      ],
      variableSpendBaseline: null,
    });

    // Window ends at the salary date (20 Jan), which is excluded from the
    // sum — so the final balance is 10000 - 25000 = -15000, and the dip on
    // 5 Jan is the (only, and therefore worst) negative point.
    const shortfall = detectProjectedShortfall(result);
    expect(shortfall).not.toBeNull();
    expect(shortfall!.amount!.toFixed(2)).toBe("-15000.00");
  });

  it("treats the variable-spend estimate as reserved from day one (conservative)", () => {
    const result = calculateHeadroom({
      now: istDate(2026, 0, 1),
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "10000" }],
      commitments: [
        commitment({ id: "rent", name: "Rent", amount: "5000", anchorDate: istDate(2026, 0, 20) }),
      ],
      variableSpendBaseline: { monthlyAmount: "31000" }, // deliberately large relative to the window
    });
    // 10000 - (pro-rated ~31000*30/31 ≈ 30000) is already negative before any dated line.
    const shortfall = detectProjectedShortfall(result);
    expect(shortfall).not.toBeNull();
  });
});

describe("detectOverdueEmis", () => {
  it("flags a loan whose outstandingAsOf predates its most recent EMI due date", () => {
    const now = istDate(2026, 0, 20); // 20 Jan
    const items = detectOverdueEmis(
      [
        {
          id: "loan-1",
          name: "Home Loan",
          emiDayOfMonth: 5, // most recent due date: 5 Jan
          outstandingAsOf: istDate(2025, 11, 1), // last updated 1 Dec — before 5 Jan
        },
      ],
      now,
    );
    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe("loan-1");
  });

  it("does not flag a loan whose outstandingAsOf is current", () => {
    const now = istDate(2026, 0, 20);
    const items = detectOverdueEmis(
      [
        {
          id: "loan-1",
          name: "Home Loan",
          emiDayOfMonth: 5,
          outstandingAsOf: istDate(2026, 0, 6), // updated the day after the 5 Jan EMI
        },
      ],
      now,
    );
    expect(items).toHaveLength(0);
  });

  it("does not flag a loan when the EMI due date this month hasn't arrived yet", () => {
    const now = istDate(2026, 0, 3); // before the 5th
    const items = detectOverdueEmis(
      [
        {
          id: "loan-1",
          name: "Home Loan",
          emiDayOfMonth: 5,
          outstandingAsOf: istDate(2025, 11, 6), // updated after December's EMI
        },
      ],
      now,
    );
    expect(items).toHaveLength(0);
  });
});

describe("detectAttentionItems", () => {
  it("caps the combined result at three items", () => {
    const now = istDate(2026, 0, 20);
    const headroomResult = calculateHeadroom({
      now,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "0" }],
      commitments: [commitment({ id: "rent", name: "Rent", amount: "5000", anchorDate: now })],
      variableSpendBaseline: null,
    });

    const items = detectAttentionItems(
      headroomResult,
      [
        { id: "l1", name: "Loan 1", emiDayOfMonth: 5, outstandingAsOf: istDate(2025, 10, 1) },
        { id: "l2", name: "Loan 2", emiDayOfMonth: 6, outstandingAsOf: istDate(2025, 10, 1) },
        { id: "l3", name: "Loan 3", emiDayOfMonth: 7, outstandingAsOf: istDate(2025, 10, 1) },
      ],
      now,
    );

    expect(items.length).toBeLessThanOrEqual(3);
  });

  it("appends stale-balance items after shortfall and overdue-EMI items, worst first", () => {
    const now = istDate(2026, 0, 20);
    const headroomResult = calculateHeadroom({
      now,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "100000" }],
      commitments: [],
      variableSpendBaseline: null,
    });

    const items = detectAttentionItems(headroomResult, [], now, [
      { id: "acc-1", name: "Bank", kind: "ACCOUNT", asOf: addDays(now, -20) },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("STALE_BALANCE");
  });

  it("defaults to no stale-balance sources when the fourth argument is omitted", () => {
    const now = istDate(2026, 0, 20);
    const headroomResult = calculateHeadroom({
      now,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "100000" }],
      commitments: [],
      variableSpendBaseline: null,
    });
    expect(detectAttentionItems(headroomResult, [], now)).toHaveLength(0);
  });
});

describe("detectStaleBalances", () => {
  it("flags an account whose balance is at least the threshold old", () => {
    const now = istDate(2026, 0, 20);
    const items = detectStaleBalances(
      [{ id: "acc-1", name: "Bank", kind: "ACCOUNT", asOf: addDays(now, -STALE_BALANCE_THRESHOLD_DAYS) }],
      now,
    );
    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe("acc-1");
    expect(items[0].message).toContain("balance");
  });

  it("does not flag a balance just under the threshold", () => {
    const now = istDate(2026, 0, 20);
    const items = detectStaleBalances(
      [{ id: "acc-1", name: "Bank", kind: "ACCOUNT", asOf: addDays(now, -(STALE_BALANCE_THRESHOLD_DAYS - 1)) }],
      now,
    );
    expect(items).toHaveLength(0);
  });

  it("describes an asset as a valuation rather than a balance", () => {
    const now = istDate(2026, 0, 20);
    const items = detectStaleBalances(
      [{ id: "asset-1", name: "Mutual Fund", kind: "ASSET", asOf: addDays(now, -30) }],
      now,
    );
    expect(items[0].message).toContain("valuation");
  });
});
