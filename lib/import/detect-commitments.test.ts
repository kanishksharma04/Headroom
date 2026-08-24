import { describe, expect, it } from "vitest";
import { detectRecurringCommitments, suggestAccountBalance } from "@/lib/import/detect-commitments";
import type { StatementTransaction } from "@/lib/import/statement-csv";
import { istDate } from "@/lib/dates";
import { toMoney } from "@/lib/money";

function tx(overrides: Partial<StatementTransaction>): StatementTransaction {
  return {
    date: istDate(2026, 0, 1),
    description: "Transaction",
    debit: null,
    credit: null,
    balance: null,
    ...overrides,
  };
}

describe("suggestAccountBalance", () => {
  it("returns the balance of the most recent transaction that has one", () => {
    const result = suggestAccountBalance([
      tx({ date: istDate(2026, 0, 1), balance: toMoney("100000") }),
      tx({ date: istDate(2026, 0, 10), balance: toMoney("120000") }),
      tx({ date: istDate(2026, 0, 5), balance: toMoney("90000") }),
    ]);
    expect(result?.balance.toFixed(2)).toBe("120000.00");
    expect(result?.asOf.getTime()).toBe(istDate(2026, 0, 10).getTime());
  });

  it("is null when no row has a balance figure", () => {
    expect(suggestAccountBalance([tx({}), tx({})])).toBeNull();
  });

  it("ignores rows without a balance even when others have one", () => {
    const result = suggestAccountBalance([
      tx({ date: istDate(2026, 0, 1), balance: toMoney("100000") }),
      tx({ date: istDate(2026, 0, 15), balance: null }),
    ]);
    expect(result?.asOf.getTime()).toBe(istDate(2026, 0, 1).getTime());
  });
});

describe("detectRecurringCommitments", () => {
  it("detects a monthly rent payment and infers its category", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 5), description: "RENT PAYMENT NEFT REF123456", debit: toMoney("20000") }),
      tx({ date: istDate(2026, 1, 5), description: "RENT PAYMENT NEFT REF234567", debit: toMoney("20000") }),
      tx({ date: istDate(2026, 2, 5), description: "RENT PAYMENT NEFT REF345678", debit: toMoney("20000") }),
    ];
    const suggestions = detectRecurringCommitments(transactions);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      direction: "OUTFLOW",
      category: "RENT",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      occurrenceCount: 3,
    });
    expect(suggestions[0].amount.toFixed(2)).toBe("20000.00");
  });

  it("detects a monthly salary credit as INFLOW/SALARY", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 1), description: "SALARY CREDIT ACME CORP", credit: toMoney("85000") }),
      tx({ date: istDate(2026, 1, 1), description: "SALARY CREDIT ACME CORP", credit: toMoney("85000") }),
    ];
    const suggestions = detectRecurringCommitments(transactions);
    expect(suggestions[0]).toMatchObject({ direction: "INFLOW", category: "SALARY", frequency: "MONTHLY" });
  });

  it("does not suggest a one-off transaction", () => {
    const transactions = [tx({ description: "ATM WITHDRAWAL", debit: toMoney("5000") })];
    expect(detectRecurringCommitments(transactions)).toHaveLength(0);
  });

  it("does not suggest transactions with inconsistent amounts", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 5), description: "UPI PAYMENT TO STORE", debit: toMoney("500") }),
      tx({ date: istDate(2026, 1, 5), description: "UPI PAYMENT TO STORE", debit: toMoney("4000") }),
      tx({ date: istDate(2026, 2, 5), description: "UPI PAYMENT TO STORE", debit: toMoney("1200") }),
    ];
    expect(detectRecurringCommitments(transactions)).toHaveLength(0);
  });

  it("does not suggest transactions with an irregular interval", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 3), description: "RANDOM STORE", debit: toMoney("1000") }),
      tx({ date: istDate(2026, 0, 20), description: "RANDOM STORE", debit: toMoney("1000") }),
      tx({ date: istDate(2026, 2, 28), description: "RANDOM STORE", debit: toMoney("1000") }),
    ];
    expect(detectRecurringCommitments(transactions)).toHaveLength(0);
  });

  it("tolerates reference numbers changing between occurrences", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 15), description: "NETFLIX.COM 8842910234", debit: toMoney("649") }),
      tx({ date: istDate(2026, 1, 15), description: "NETFLIX.COM 7723840912", debit: toMoney("649") }),
    ];
    const suggestions = detectRecurringCommitments(transactions);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].category).toBe("SUBSCRIPTION");
    expect(suggestions[0].name).toBe("Netflix.com");
  });

  it("tolerates a small amount variation within 5%", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 5), description: "SIP FLEXICAP FUND", debit: toMoney("5000") }),
      tx({ date: istDate(2026, 1, 5), description: "SIP FLEXICAP FUND", debit: toMoney("5100") }),
      tx({ date: istDate(2026, 2, 5), description: "SIP FLEXICAP FUND", debit: toMoney("5000") }),
    ];
    expect(detectRecurringCommitments(transactions)).toHaveLength(1);
  });

  it("keeps inflow and outflow groups with the same description separate", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 1), description: "ACME CORP", credit: toMoney("85000") }),
      tx({ date: istDate(2026, 1, 1), description: "ACME CORP", credit: toMoney("85000") }),
      tx({ date: istDate(2026, 0, 10), description: "ACME CORP", debit: toMoney("2000") }),
      tx({ date: istDate(2026, 1, 10), description: "ACME CORP", debit: toMoney("2000") }),
    ];
    const suggestions = detectRecurringCommitments(transactions);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.direction).sort()).toEqual(["INFLOW", "OUTFLOW"]);
  });

  it("detects a quarterly payment", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 10), description: "INSURANCE PREMIUM", debit: toMoney("6000") }),
      tx({ date: istDate(2026, 3, 10), description: "INSURANCE PREMIUM", debit: toMoney("6000") }),
      tx({ date: istDate(2026, 6, 10), description: "INSURANCE PREMIUM", debit: toMoney("6000") }),
    ];
    const suggestions = detectRecurringCommitments(transactions);
    expect(suggestions[0]).toMatchObject({ category: "INSURANCE", frequency: "QUARTERLY" });
  });

  it("doesn't mis-categorise a description that merely contains a keyword as a substring", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 5), description: "CURRENT AC TRANSFER XYZ", debit: toMoney("3000") }),
      tx({ date: istDate(2026, 1, 5), description: "CURRENT AC TRANSFER XYZ", debit: toMoney("3000") }),
    ];
    const suggestions = detectRecurringCommitments(transactions);
    expect(suggestions).toHaveLength(1);
    // "CURRENT" contains "RENT" as a substring — must not be tagged RENT.
    expect(suggestions[0].category).not.toBe("RENT");
    expect(suggestions[0].category).toBe("OTHER");
  });

  it("still matches a keyword glued to punctuation rather than spaces", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 5), description: "AIRTEL-DTH RECHARGE", debit: toMoney("300") }),
      tx({ date: istDate(2026, 1, 5), description: "AIRTEL-DTH RECHARGE", debit: toMoney("300") }),
    ];
    const suggestions = detectRecurringCommitments(transactions);
    expect(suggestions[0].category).toBe("UTILITY");
  });

  it("sorts suggestions by occurrence count, most-confident first", () => {
    const transactions = [
      tx({ date: istDate(2026, 0, 5), description: "RENT", debit: toMoney("20000") }),
      tx({ date: istDate(2026, 1, 5), description: "RENT", debit: toMoney("20000") }),
      tx({ date: istDate(2026, 2, 5), description: "RENT", debit: toMoney("20000") }),
      tx({ date: istDate(2026, 3, 5), description: "RENT", debit: toMoney("20000") }),
      tx({ date: istDate(2026, 0, 15), description: "NETFLIX", debit: toMoney("649") }),
      tx({ date: istDate(2026, 1, 15), description: "NETFLIX", debit: toMoney("649") }),
    ];
    const suggestions = detectRecurringCommitments(transactions);
    expect(suggestions[0].name).toBe("Rent");
    expect(suggestions[0].occurrenceCount).toBe(4);
  });
});
