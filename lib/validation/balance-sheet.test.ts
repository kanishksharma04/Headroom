import { describe, expect, it } from "vitest";
import { accountFormSchema } from "@/lib/validation/account";
import { assetFormSchema } from "@/lib/validation/asset";
import { liabilityFormSchema } from "@/lib/validation/liability";
import { dateOnlyString } from "@/lib/validation/date";
import { getIstParts } from "@/lib/dates";

describe("dateOnlyString", () => {
  it("parses a YYYY-MM-DD string as IST midnight on that day", () => {
    const result = dateOnlyString.parse("2026-08-15");
    expect(getIstParts(result)).toMatchObject({ year: 2026, month: 7, day: 15, hour: 0 });
  });

  it("rejects malformed dates", () => {
    expect(dateOnlyString.safeParse("15-08-2026").success).toBe(false);
    expect(dateOnlyString.safeParse("not a date").success).toBe(false);
  });
});

describe("accountFormSchema", () => {
  it("accepts a valid savings account", () => {
    const result = accountFormSchema.safeParse({
      name: "HDFC Savings",
      type: "SAVINGS",
      currentBalance: "150000",
      isJoint: false,
      balanceAsOf: "2026-08-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = accountFormSchema.safeParse({
      name: "",
      type: "SAVINGS",
      currentBalance: "150000",
      isJoint: false,
      balanceAsOf: "2026-08-15",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid account type", () => {
    const result = accountFormSchema.safeParse({
      name: "HDFC Savings",
      type: "CRYPTO",
      currentBalance: "150000",
      isJoint: false,
      balanceAsOf: "2026-08-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("assetFormSchema", () => {
  it("accepts a valid EPF asset with an optional field omitted", () => {
    const result = assetFormSchema.safeParse({
      name: "EPF",
      type: "EPF",
      investedAmount: "600000",
      currentValue: "620000",
      valuationAsOf: "2026-08-15",
      expectedAnnualReturnPercent: "",
      isJoint: false,
      notes: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expectedAnnualReturnPercent).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("rejects a negative current value", () => {
    const result = assetFormSchema.safeParse({
      name: "EPF",
      type: "EPF",
      investedAmount: "600000",
      currentValue: "-100",
      valuationAsOf: "2026-08-15",
      isJoint: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("liabilityFormSchema", () => {
  it("accepts a valid self-occupied home loan", () => {
    const result = liabilityFormSchema.safeParse({
      name: "Home Loan",
      type: "HOME_LOAN",
      principalAmount: "4000000",
      annualInterestRatePercent: "8.6",
      startDate: "2024-05-05",
      tenureMonths: 240,
      emiAmount: "34966.51",
      emiDayOfMonth: 5,
      outstandingPrincipal: "3840000",
      outstandingAsOf: "2026-08-15",
      prepaymentPenaltyPercent: "",
      isTaxDeductible: true,
      isSelfOccupied: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero principal", () => {
    const result = liabilityFormSchema.safeParse({
      name: "Home Loan",
      type: "HOME_LOAN",
      principalAmount: "0",
      annualInterestRatePercent: "8.6",
      startDate: "2024-05-05",
      tenureMonths: 240,
      emiAmount: "34966.51",
      emiDayOfMonth: 5,
      outstandingPrincipal: "0",
      outstandingAsOf: "2026-08-15",
      isTaxDeductible: true,
      isSelfOccupied: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range day of month", () => {
    const result = liabilityFormSchema.safeParse({
      name: "Home Loan",
      type: "HOME_LOAN",
      principalAmount: "4000000",
      annualInterestRatePercent: "8.6",
      startDate: "2024-05-05",
      tenureMonths: 240,
      emiAmount: "34966.51",
      emiDayOfMonth: 35,
      outstandingPrincipal: "3840000",
      outstandingAsOf: "2026-08-15",
      isTaxDeductible: true,
      isSelfOccupied: true,
    });
    expect(result.success).toBe(false);
  });
});
