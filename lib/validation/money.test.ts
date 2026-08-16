import { describe, expect, it } from "vitest";
import {
  moneyString,
  moneyStringSchema,
  nonNegativeMoneyStringSchema,
  positiveMoneyStringSchema,
} from "@/lib/validation/money";

describe("moneyString", () => {
  it("accepts plain decimal strings", () => {
    expect(moneyString.safeParse("1200.50").success).toBe(true);
    expect(moneyString.safeParse("0").success).toBe(true);
    expect(moneyString.safeParse("-500").success).toBe(true);
    expect(moneyString.safeParse("  1200.50  ").success).toBe(true);
  });

  it("rejects empty input", () => {
    expect(moneyString.safeParse("").success).toBe(false);
    expect(moneyString.safeParse("   ").success).toBe(false);
  });

  it("rejects scientific notation and non-numeric input", () => {
    expect(moneyString.safeParse("1e5").success).toBe(false);
    expect(moneyString.safeParse("abc").success).toBe(false);
    expect(moneyString.safeParse("₹1,200").success).toBe(false);
    expect(moneyString.safeParse("12.34.56").success).toBe(false);
  });

  it("rejects more decimal places than allowed", () => {
    expect(moneyString.safeParse("1.23456").success).toBe(false); // default max 4
    expect(moneyString.safeParse("1.2345").success).toBe(true);
  });

  it("respects a custom maxDecimalPlaces", () => {
    const schema = moneyStringSchema({ maxDecimalPlaces: 2 });
    expect(schema.safeParse("1.234").success).toBe(false);
    expect(schema.safeParse("1.23").success).toBe(true);
  });
});

describe("nonNegativeMoneyStringSchema", () => {
  it("rejects negative amounts", () => {
    const schema = nonNegativeMoneyStringSchema();
    expect(schema.safeParse("-1").success).toBe(false);
    expect(schema.safeParse("0").success).toBe(true);
    expect(schema.safeParse("100").success).toBe(true);
  });
});

describe("positiveMoneyStringSchema", () => {
  it("rejects zero and negative amounts", () => {
    const schema = positiveMoneyStringSchema();
    expect(schema.safeParse("-1").success).toBe(false);
    expect(schema.safeParse("0").success).toBe(false);
    expect(schema.safeParse("0.00").success).toBe(false);
    expect(schema.safeParse("0.01").success).toBe(true);
  });
});
