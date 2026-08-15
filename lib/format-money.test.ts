import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyShorthand, groupIndianDigits } from "@/lib/format-money";

describe("groupIndianDigits", () => {
  it("leaves three or fewer digits untouched", () => {
    expect(groupIndianDigits("0")).toBe("0");
    expect(groupIndianDigits("42")).toBe("42");
    expect(groupIndianDigits("300")).toBe("300");
  });

  it("groups the Indian way: last three, then pairs", () => {
    expect(groupIndianDigits("1234")).toBe("1,234");
    expect(groupIndianDigits("120000")).toBe("1,20,000");
    expect(groupIndianDigits("1234567")).toBe("12,34,567");
    expect(groupIndianDigits("123456789")).toBe("12,34,56,789");
  });
});

describe("formatMoney", () => {
  it("formats whole rupees with the Indian grouping by default", () => {
    expect(formatMoney("120000")).toBe("₹1,20,000");
    expect(formatMoney(42300)).toBe("₹42,300");
  });

  it("formats negative values with a leading minus before the rupee sign", () => {
    expect(formatMoney("-42300")).toBe("-₹42,300");
  });

  it("shows decimals when requested and rounds half up", () => {
    expect(formatMoney("42300.005", { decimals: 2 })).toBe("₹42,300.01");
    expect(formatMoney("1234567.891", { decimals: 2 })).toBe("₹12,34,567.89");
  });

  it("prefixes a plus sign for positive values only when showSign is set", () => {
    expect(formatMoney("5000", { showSign: true })).toBe("+₹5,000");
    expect(formatMoney("-5000", { showSign: true })).toBe("-₹5,000");
    expect(formatMoney("0", { showSign: true })).toBe("₹0");
  });

  it("never loses precision for large exact decimal values", () => {
    expect(formatMoney("123456789012.3456", { decimals: 4 })).toBe("₹1,23,45,67,89,012.3456");
  });
});

describe("formatMoneyShorthand", () => {
  it("falls back to full grouping below one lakh", () => {
    expect(formatMoneyShorthand("99999")).toBe("₹99,999");
  });

  it("uses lakh shorthand between one lakh and one crore", () => {
    expect(formatMoneyShorthand("3840000")).toBe("₹38.4L");
    expect(formatMoneyShorthand("100000")).toBe("₹1.0L");
  });

  it("uses crore shorthand at and above one crore", () => {
    expect(formatMoneyShorthand("12000000")).toBe("₹1.2Cr");
    expect(formatMoneyShorthand("10000000")).toBe("₹1.0Cr");
  });

  it("preserves the negative sign", () => {
    expect(formatMoneyShorthand("-3840000")).toBe("-₹38.4L");
  });
});
