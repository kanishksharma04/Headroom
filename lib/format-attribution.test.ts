import { describe, expect, it } from "vitest";
import { describeNetWorthAttribution } from "@/lib/format-attribution";
import { attributeNetWorthChange, type NetWorthSnapshot } from "@/lib/engines/networth";

describe("describeNetWorthAttribution", () => {
  it("mentions every non-zero bucket in plain language", () => {
    const previous: NetWorthSnapshot = {
      accounts: [],
      assets: [
        { id: "mf-1", currentValue: "500000", investedAmount: "450000" },
        { id: "epf-1", currentValue: "600000", investedAmount: "600000" },
      ],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "3840000" }],
    };
    const current: NetWorthSnapshot = {
      accounts: [],
      assets: [
        { id: "mf-1", currentValue: "551000", investedAmount: "470000" },
        { id: "epf-1", currentValue: "616000", investedAmount: "616000" },
      ],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "3812000" }],
    };

    const attribution = attributeNetWorthChange(previous, current);
    const sentence = describeNetWorthAttribution(attribution);

    expect(sentence).toContain("rose");
    expect(sentence).toContain("contributed");
    expect(sentence).toContain("market movement");
    expect(sentence).toContain("repaid");
    expect(sentence).not.toContain("other changes");
  });

  it("describes a fall correctly", () => {
    const previous: NetWorthSnapshot = {
      accounts: [{ id: "a1", currentBalance: "100000" }],
      assets: [],
      liabilities: [],
    };
    const current: NetWorthSnapshot = {
      accounts: [{ id: "a1", currentBalance: "60000" }],
      assets: [],
      liabilities: [],
    };
    const sentence = describeNetWorthAttribution(attributeNetWorthChange(previous, current));
    expect(sentence).toContain("fell");
    expect(sentence).toContain("other changes");
  });

  it("handles no change gracefully", () => {
    const snapshot: NetWorthSnapshot = {
      accounts: [{ id: "a1", currentBalance: "100000" }],
      assets: [],
      liabilities: [],
    };
    const sentence = describeNetWorthAttribution(attributeNetWorthChange(snapshot, snapshot));
    expect(sentence).toBe("Your net worth was unchanged.");
  });
});
