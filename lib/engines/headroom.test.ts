import { describe, expect, it } from "vitest";
import { calculateHeadroom, type HeadroomCommitmentInput } from "@/lib/engines/headroom";
import { getIstParts, istDate } from "@/lib/dates";

function commitment(overrides: Partial<HeadroomCommitmentInput>): HeadroomCommitmentInput {
  return {
    id: "c",
    name: "Commitment",
    direction: "OUTFLOW",
    category: "OTHER",
    amount: "1000",
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 8, 1),
    dayOfMonth: null,
    endDate: null,
    isActive: true,
    isVariable: false,
    ...overrides,
  };
}

describe("calculateHeadroom — the worked example (research §16.2)", () => {
  it("reproduces ₹42,300 exactly from ₹1,20,000 in accounts less the listed commitments", () => {
    const today = istDate(2026, 8, 1); // 1 Sep 2026 — September has 30 days

    const result = calculateHeadroom({
      now: today,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "120000" }],
      commitments: [
        commitment({
          id: "cc",
          name: "Credit card",
          category: "CREDIT_CARD_BILL",
          amount: "18000",
          anchorDate: istDate(2026, 8, 20),
        }),
        commitment({
          id: "rent",
          name: "Rent",
          category: "RENT",
          amount: "25000",
          // Deliberately not the 1st: the window's own boundaries (1 Sep,
          // 1 Oct) fall on the 1st, and a monthly commitment anchored
          // there would legitimately match both ends of an exactly
          // 30-day window that spans one full month — a real double
          // instalment, not a bug, but not what this fixture is testing.
          anchorDate: istDate(2026, 8, 15),
        }),
        commitment({
          id: "sip",
          name: "SIP",
          category: "SIP",
          amount: "10000",
          anchorDate: istDate(2026, 8, 5),
        }),
        commitment({
          id: "emi",
          name: "Home loan EMI",
          category: "EMI",
          amount: "7500",
          anchorDate: istDate(2026, 8, 5),
        }),
        commitment({
          id: "subs",
          name: "Subscriptions & utilities",
          category: "SUBSCRIPTION",
          amount: "4200",
          anchorDate: istDate(2026, 8, 10),
        }),
      ],
      variableSpendBaseline: { monthlyAmount: "13000" },
    });

    expect(result.window.basis).toBe("THIRTY_DAY");
    expect(result.window.days).toBe(30);
    expect(result.amount.toFixed(2)).toBe("42300.00");

    // Every listed line, with its exact signed amount.
    const byLabel = Object.fromEntries(result.lines.map((l) => [l.label, l.amount.toFixed(2)]));
    expect(byLabel["Bank"]).toBe("120000.00");
    expect(byLabel["Credit card"]).toBe("-18000.00");
    expect(byLabel["Rent"]).toBe("-25000.00");
    expect(byLabel["SIP"]).toBe("-10000.00");
    expect(byLabel["Home loan EMI"]).toBe("-7500.00");
    expect(byLabel["Subscriptions & utilities"]).toBe("-4200.00");
    expect(byLabel["Typical variable spend"]).toBe("-13000.00");
  });
});

describe("calculateHeadroom — no commitments", () => {
  it("headroom equals the account balance, using the 30-day fallback", () => {
    const today = istDate(2026, 0, 1);
    const result = calculateHeadroom({
      now: today,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "50000" }],
      commitments: [],
      variableSpendBaseline: null,
    });

    expect(result.amount.toFixed(2)).toBe("50000.00");
    expect(result.window.basis).toBe("THIRTY_DAY");
    expect(result.lines).toHaveLength(1);
  });
});

describe("calculateHeadroom — salary resolves the window", () => {
  it("salary mid-window: other commitments before the salary date are included, salary itself is excluded", () => {
    const today = istDate(2026, 7, 6); // 6 Aug 2026, the day after the last salary credit

    const result = calculateHeadroom({
      now: today,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "100000" }],
      commitments: [
        commitment({
          id: "salary",
          name: "Salary",
          direction: "INFLOW",
          category: "SALARY",
          amount: "80000",
          anchorDate: istDate(2026, 6, 5), // anchored 5 Jul, monthly -> next is 5 Sep
          dayOfMonth: 5,
        }),
        commitment({
          id: "rent",
          name: "Rent",
          category: "RENT",
          amount: "20000",
          anchorDate: istDate(2026, 7, 15), // 15 Aug — falls inside the window
        }),
      ],
      variableSpendBaseline: null,
    });

    expect(result.window.basis).toBe("NEXT_SALARY");
    expect(getIstParts(result.window.to)).toMatchObject({ year: 2026, month: 8, day: 5 });

    const labels = result.lines.map((l) => l.label);
    expect(labels).not.toContain("Salary");
    expect(labels).toContain("Rent");
    expect(result.amount.toFixed(2)).toBe("80000.00"); // 100000 - 20000 rent, salary excluded
  });

  it("salary outside window: an already-ended salary commitment is ignored, falling back to 30 days", () => {
    const today = istDate(2026, 0, 15);

    const result = calculateHeadroom({
      now: today,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "60000" }],
      commitments: [
        commitment({
          id: "old-salary",
          name: "Old job salary",
          direction: "INFLOW",
          category: "SALARY",
          amount: "70000",
          anchorDate: istDate(2025, 0, 1),
          dayOfMonth: 1,
          endDate: istDate(2025, 11, 1), // ended before "today"
        }),
      ],
      variableSpendBaseline: null,
    });

    expect(result.window.basis).toBe("THIRTY_DAY");
    expect(result.lines.map((l) => l.label)).not.toContain("Old job salary");
  });
});

describe("calculateHeadroom — negative headroom is reported honestly", () => {
  it("does not clamp a negative result to zero", () => {
    const today = istDate(2026, 0, 1);
    const result = calculateHeadroom({
      now: today,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "10000" }],
      commitments: [
        commitment({ id: "rent", name: "Rent", category: "RENT", amount: "25000", anchorDate: today }),
      ],
      variableSpendBaseline: null,
    });

    expect(result.amount.toFixed(2)).toBe("-15000.00");
  });
});

describe("calculateHeadroom — a month-end-heavy commitment cluster", () => {
  it("correctly aggregates several month-end-clamped occurrences together", () => {
    // Three monthly commitments anchored on the 31st/30th/29th of a prior
    // month; the window covers February 2026 (28 days), so all three must
    // clamp to 28 Feb and land inside it.
    const today = istDate(2026, 1, 1); // 1 Feb 2026

    const result = calculateHeadroom({
      now: today,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "0" }],
      commitments: [
        commitment({
          id: "bill-31",
          name: "Bill anchored 31st",
          amount: "1000",
          anchorDate: istDate(2025, 11, 31),
        }),
        commitment({
          id: "bill-30",
          name: "Bill anchored 30th",
          amount: "2000",
          anchorDate: istDate(2025, 11, 30),
        }),
        commitment({
          id: "bill-29",
          name: "Bill anchored 29th",
          amount: "3000",
          anchorDate: istDate(2025, 11, 29),
        }),
      ],
      variableSpendBaseline: null,
    });

    const dated = result.lines.filter((l) => l.date);
    expect(dated).toHaveLength(3);
    for (const line of dated) {
      expect(getIstParts(line.date!)).toMatchObject({ year: 2026, month: 1, day: 28 });
    }
    expect(result.amount.toFixed(2)).toBe("-6000.00"); // 0 - 1000 - 2000 - 3000
  });
});

describe("calculateHeadroom — no variable spend baseline set", () => {
  it("adds no VARIABLE_ESTIMATE line and states the assumption explicitly", () => {
    const today = istDate(2026, 0, 1);
    const result = calculateHeadroom({
      now: today,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "50000" }],
      commitments: [],
      variableSpendBaseline: null,
    });

    expect(result.lines.some((l) => l.kind === "VARIABLE_ESTIMATE")).toBe(false);
    expect(
      result.assumptions.some((a) => a.toLowerCase().includes("no variable spend estimate")),
    ).toBe(true);
  });
});

describe("calculateHeadroom — every line is traceable to a source", () => {
  it("balances and commitments carry their source id; the variable estimate does not", () => {
    const today = istDate(2026, 0, 1);
    const result = calculateHeadroom({
      now: today,
      accounts: [{ id: "acc-1", name: "Bank", currentBalance: "50000" }],
      commitments: [
        commitment({
          id: "rent-1",
          name: "Rent",
          category: "RENT",
          amount: "20000",
          anchorDate: istDate(2026, 0, 10),
        }),
      ],
      variableSpendBaseline: { monthlyAmount: "6000" },
    });

    const balanceLine = result.lines.find((l) => l.kind === "BALANCE")!;
    const outflowLine = result.lines.find((l) => l.kind === "OUTFLOW")!;
    const estimateLine = result.lines.find((l) => l.kind === "VARIABLE_ESTIMATE")!;

    expect(balanceLine.sourceId).toBe("acc-1");
    expect(outflowLine.sourceId).toBe("rent-1");
    expect(estimateLine.sourceId).toBeNull();
    expect(estimateLine.isEstimate).toBe(true);
  });
});
