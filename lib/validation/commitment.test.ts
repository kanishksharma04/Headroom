import { describe, expect, it } from "vitest";
import { commitmentFormSchema } from "@/lib/validation/commitment";
import { variableSpendFormSchema } from "@/lib/validation/variable-spend";

describe("commitmentFormSchema", () => {
  const base = {
    name: "Rent",
    direction: "OUTFLOW" as const,
    category: "RENT" as const,
    amount: "25000",
    isVariable: false,
    frequency: "MONTHLY" as const,
    anchorDate: "2026-09-01",
  };

  it("accepts a valid monthly commitment with no optional fields", () => {
    expect(commitmentFormSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an explicit dayOfMonth and endDate", () => {
    const result = commitmentFormSchema.safeParse({
      ...base,
      dayOfMonth: "5",
      endDate: "2027-09-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dayOfMonth).toBe(5);
    }
  });

  it("rejects an end date before the anchor date", () => {
    const result = commitmentFormSchema.safeParse({
      ...base,
      anchorDate: "2026-09-01",
      endDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a day of month out of range", () => {
    const result = commitmentFormSchema.safeParse({ ...base, dayOfMonth: "32" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid frequency", () => {
    const result = commitmentFormSchema.safeParse({ ...base, frequency: "WEEKLY" });
    expect(result.success).toBe(false);
  });
});

describe("variableSpendFormSchema", () => {
  it("accepts a positive monthly amount", () => {
    expect(variableSpendFormSchema.safeParse({ monthlyAmount: "15000" }).success).toBe(true);
  });

  it("rejects zero", () => {
    expect(variableSpendFormSchema.safeParse({ monthlyAmount: "0" }).success).toBe(false);
  });
});
