import { describe, expect, it } from "vitest";
import { assetFormSchema } from "@/lib/validation/asset";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "HDFC Flexicap",
    type: "MUTUAL_FUND",
    investedAmount: "100000",
    currentValue: "120000",
    valuationAsOf: "2026-08-01",
    isJoint: false,
    ...overrides,
  };
}

describe("assetFormSchema — price sync fields", () => {
  it("accepts an asset with neither scheme code nor units held", () => {
    const result = assetFormSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it("accepts a mutual fund with both scheme code and units held", () => {
    const result = assetFormSchema.safeParse(baseInput({ amfiSchemeCode: "119551", unitsHeld: "1250.5" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amfiSchemeCode).toBe("119551");
      expect(result.data.unitsHeld).toBe("1250.5");
    }
  });

  it("rejects a scheme code with no units held", () => {
    const result = assetFormSchema.safeParse(baseInput({ amfiSchemeCode: "119551" }));
    expect(result.success).toBe(false);
  });

  it("rejects units held with no scheme code", () => {
    const result = assetFormSchema.safeParse(baseInput({ unitsHeld: "1250.5" }));
    expect(result.success).toBe(false);
  });

  it("rejects a scheme code on a non-mutual-fund asset type", () => {
    const result = assetFormSchema.safeParse(
      baseInput({ type: "EQUITY", amfiSchemeCode: "119551", unitsHeld: "10" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric scheme code", () => {
    const result = assetFormSchema.safeParse(baseInput({ amfiSchemeCode: "abc123", unitsHeld: "10" }));
    expect(result.success).toBe(false);
  });

  it("treats an empty-string scheme code the same as omitted", () => {
    const result = assetFormSchema.safeParse(baseInput({ amfiSchemeCode: "", unitsHeld: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amfiSchemeCode).toBeUndefined();
      expect(result.data.unitsHeld).toBeUndefined();
    }
  });

  it("rejects negative units held", () => {
    const result = assetFormSchema.safeParse(baseInput({ amfiSchemeCode: "119551", unitsHeld: "-5" }));
    expect(result.success).toBe(false);
  });
});
