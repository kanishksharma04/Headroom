import { describe, expect, it } from "vitest";
import { affordabilityCheckSchema, prepayVsInvestScenarioSchema } from "@/lib/validation/scenario";

describe("prepayVsInvestScenarioSchema", () => {
  it("accepts a valid scenario", () => {
    const result = prepayVsInvestScenarioSchema.safeParse({
      name: "Prepay 2L this Diwali",
      liabilityId: "liab-1",
      lumpSum: "200000",
      prepaymentMode: "REDUCE_TENURE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero lump sum", () => {
    const result = prepayVsInvestScenarioSchema.safeParse({
      name: "Test",
      liabilityId: "liab-1",
      lumpSum: "0",
      prepaymentMode: "REDUCE_TENURE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid prepayment mode", () => {
    const result = prepayVsInvestScenarioSchema.safeParse({
      name: "Test",
      liabilityId: "liab-1",
      lumpSum: "200000",
      prepaymentMode: "SOMETHING_ELSE",
    });
    expect(result.success).toBe(false);
  });
});

describe("affordabilityCheckSchema", () => {
  it("accepts a valid purchase", () => {
    const result = affordabilityCheckSchema.safeParse({
      purchaseAmount: "150000",
      purchaseDate: "2026-09-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative purchase amount", () => {
    const result = affordabilityCheckSchema.safeParse({
      purchaseAmount: "-1000",
      purchaseDate: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });
});
