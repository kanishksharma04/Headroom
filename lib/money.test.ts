import { describe, expect, it } from "vitest";
import {
  add,
  allocate,
  compare,
  divide,
  isNegative,
  isPositive,
  isZero,
  max,
  min,
  multiply,
  parseMoney,
  roundCurrency,
  serializeMoney,
  subtract,
  sum,
} from "@/lib/money";

describe("arithmetic avoids floating point drift", () => {
  it("0.1 + 0.2 is exactly 0.3, not 0.30000000000000004", () => {
    expect(add("0.1", "0.2").toString()).toBe("0.3");
  });

  it("repeated division does not accumulate error", () => {
    // 10 / 3 * 3 must land back on exactly 10 when done in decimal, unlike
    // JS float math which drifts (10 / 3 * 3 === 9.999999999999998 in IEEE 754).
    const third = divide("10", "3");
    const backToTen = multiply(third, "3");
    expect(backToTen.toFixed(0)).toBe("10");
  });

  it("chained subtraction of many small amounts is exact", () => {
    let balance = "1000";
    for (let i = 0; i < 1000; i++) {
      balance = subtract(balance, "0.01").toString();
    }
    expect(balance).toBe("990");
  });
});

describe("basic operators", () => {
  it("add/subtract/multiply/divide", () => {
    expect(add("100", "50").toString()).toBe("150");
    expect(subtract("100", "50").toString()).toBe("50");
    expect(multiply("100", "1.5").toString()).toBe("150");
    expect(divide("100", "4").toString()).toBe("25");
  });

  it("compare", () => {
    expect(compare("5", "10")).toBe(-1);
    expect(compare("10", "10")).toBe(0);
    expect(compare("10", "5")).toBe(1);
  });

  it("sign predicates treat zero as neither positive nor negative", () => {
    expect(isZero("0")).toBe(true);
    expect(isNegative("0")).toBe(false);
    expect(isPositive("0")).toBe(false);
    expect(isNegative("-5")).toBe(true);
    expect(isPositive("5")).toBe(true);
  });

  it("sum, min, max", () => {
    expect(sum(["100", "200", "-50"]).toString()).toBe("250");
    expect(sum([]).toString()).toBe("0");
    expect(min("5", "10").toString()).toBe("5");
    expect(max("5", "10").toString()).toBe("10");
  });
});

describe("roundCurrency", () => {
  it("rounds half up to the given decimal places", () => {
    expect(roundCurrency("42300.005", 2).toString()).toBe("42300.01");
    expect(roundCurrency("42300.004", 2).toString()).toBe("42300");
    expect(roundCurrency("42300", 2).toString()).toBe("42300");
  });

  it("rounds negative values half up in magnitude away from zero", () => {
    // decimal.js ROUND_HALF_UP rounds ties away from zero.
    expect(roundCurrency("-42300.005", 2).toString()).toBe("-42300.01");
  });
});

describe("allocate", () => {
  it("splits a total equally with the remainder going to the earliest shares", () => {
    const shares = allocate("100", [1, 1, 1]).map((s) => s.toString());
    expect(shares).toEqual(["33.34", "33.33", "33.33"]);
    // The parts must sum back to the exact original — this is the entire point.
    expect(sum(shares).toString()).toBe("100");
  });

  it("splits proportionally by weighted ratios", () => {
    const raw = allocate("100", [1, 2, 3]);
    expect(sum(raw).toString()).toBe("100");
    // 1:2:3 of 100 = 16.67 : 33.33 : 50.00 with the leftover cent resolved by remainder.
    expect(raw.map((s) => s.toFixed(2))).toEqual(["16.67", "33.33", "50.00"]);
  });

  it("handles a total that already divides evenly", () => {
    const shares = allocate("90", [1, 1, 1]).map((s) => s.toString());
    expect(shares).toEqual(["30", "30", "30"]);
  });

  it("handles a single-way split", () => {
    const shares = allocate("42300.50", [1]).map((s) => s.toString());
    expect(shares).toEqual(["42300.5"]);
  });

  it("throws when ratios sum to zero", () => {
    expect(() => allocate("100", [0, 0])).toThrow();
  });

  it("returns an empty array for an empty ratio list", () => {
    expect(allocate("100", [])).toEqual([]);
  });
});

describe("serialization", () => {
  it("round-trips a precise decimal value without loss", () => {
    const serialized = serializeMoney("123456789012.3456");
    expect(serialized).toBe("123456789012.3456");
    expect(parseMoney(serialized).toString()).toBe("123456789012.3456");
  });

  it("serializes at 4 decimal places by default, padding as needed", () => {
    expect(serializeMoney("100")).toBe("100.0000");
  });
});
