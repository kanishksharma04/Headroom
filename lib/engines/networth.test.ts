import { describe, expect, it } from "vitest";
import {
  allocationByType,
  attributeNetWorthChange,
  calculateNetWorth,
  splitNetWorthByOwnership,
  type NetWorthSnapshot,
} from "@/lib/engines/networth";

describe("calculateNetWorth", () => {
  it("sums accounts and assets, subtracts liabilities", () => {
    const result = calculateNetWorth({
      accounts: [{ currentBalance: "150000" }, { currentBalance: "30000" }],
      assets: [{ currentValue: "620000" }],
      liabilities: [{ outstandingPrincipal: "3840000" }],
    });

    expect(result.totalAssets.toFixed(2)).toBe("800000.00");
    expect(result.totalLiabilities.toFixed(2)).toBe("3840000.00");
    expect(result.netWorth.toFixed(2)).toBe("-3040000.00");
  });

  it("handles an account, an EPF asset and a home loan together", () => {
    const result = calculateNetWorth({
      accounts: [{ currentBalance: "184230" }],
      assets: [{ currentValue: "620000" }], // EPF
      liabilities: [{ outstandingPrincipal: "3840000" }], // home loan
    });

    expect(result.netWorth.toFixed(2)).toBe((184230 + 620000 - 3840000).toFixed(2));
  });

  it("is zero with nothing to account for", () => {
    const result = calculateNetWorth({ accounts: [], assets: [], liabilities: [] });
    expect(result.netWorth.toFixed(2)).toBe("0.00");
  });
});

describe("splitNetWorthByOwnership", () => {
  it("puts a joint home loan against joint assets, not individual ones", () => {
    const split = splitNetWorthByOwnership({
      accounts: [{ currentBalance: "184230", isJoint: false }],
      assets: [{ currentValue: "620000", isJoint: false }], // individual EPF
      liabilities: [{ outstandingPrincipal: "3840000", isJoint: true }], // joint home loan
    });

    // The individual half owes nothing on the joint loan — it's not netted
    // against personal savings at all.
    expect(split.individual.netWorth.toFixed(2)).toBe((184230 + 620000).toFixed(2));
    expect(split.individual.totalLiabilities.toFixed(2)).toBe("0.00");
    // The joint half is entirely the loan, with nothing to offset it.
    expect(split.joint.netWorth.toFixed(2)).toBe("-3840000.00");
    expect(split.joint.totalAssets.toFixed(2)).toBe("0.00");
  });

  it("individual + joint net worth always equals the combined total", () => {
    const input = {
      accounts: [
        { currentBalance: "85000", isJoint: false },
        { currentBalance: "35000", isJoint: true },
      ],
      assets: [
        { currentValue: "620000", isJoint: false },
        { currentValue: "380000", isJoint: true },
      ],
      liabilities: [
        { outstandingPrincipal: "3840000", isJoint: true },
        { outstandingPrincipal: "50000", isJoint: false },
      ],
    };
    const split = splitNetWorthByOwnership(input);
    const combined = calculateNetWorth(input);

    expect(split.individual.netWorth.plus(split.joint.netWorth).toFixed(2)).toBe(
      combined.netWorth.toFixed(2),
    );
  });

  it("is all-individual when nothing is flagged joint", () => {
    const split = splitNetWorthByOwnership({
      accounts: [{ currentBalance: "100000", isJoint: false }],
      assets: [],
      liabilities: [],
    });
    expect(split.individual.netWorth.toFixed(2)).toBe("100000.00");
    expect(split.joint.netWorth.toFixed(2)).toBe("0.00");
  });

  it("is zero on both sides with nothing at all", () => {
    const split = splitNetWorthByOwnership({ accounts: [], assets: [], liabilities: [] });
    expect(split.individual.netWorth.toFixed(2)).toBe("0.00");
    expect(split.joint.netWorth.toFixed(2)).toBe("0.00");
  });
});

describe("allocationByType", () => {
  it("groups by type and computes each share of the total", () => {
    const allocation = allocationByType(
      [
        { type: "EPF", currentValue: "600000" },
        { type: "PPF", currentValue: "200000" },
        { type: "EPF", currentValue: "100000" },
      ],
      (item) => item.currentValue,
    );

    const epf = allocation.find((a) => a.type === "EPF")!;
    const ppf = allocation.find((a) => a.type === "PPF")!;

    expect(epf.value.toFixed(2)).toBe("700000.00");
    expect(ppf.value.toFixed(2)).toBe("200000.00");
    expect(epf.percentOfTotal.toFixed(2)).toBe("77.78");
    expect(ppf.percentOfTotal.toFixed(2)).toBe("22.22");
  });

  it("returns zero percentages rather than dividing by zero when the total is zero", () => {
    const allocation = allocationByType(
      [{ type: "EPF", currentValue: "0" }],
      (item) => item.currentValue,
    );
    expect(allocation[0].percentOfTotal.toFixed(2)).toBe("0.00");
  });
});

describe("attributeNetWorthChange", () => {
  it("decomposes a synthetic month-over-month change accurately", () => {
    // Matches the research doc's worked example in shape: contributions,
    // market movement, and principal repayment all present simultaneously.
    const previous: NetWorthSnapshot = {
      accounts: [{ id: "acc-1", currentBalance: "150000" }],
      assets: [
        { id: "mf-1", currentValue: "500000", investedAmount: "450000" },
        { id: "epf-1", currentValue: "600000", investedAmount: "600000" },
      ],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "3840000" }],
    };

    const current: NetWorthSnapshot = {
      accounts: [{ id: "acc-1", currentBalance: "150000" }], // unchanged
      assets: [
        // +20000 contributed, value rose 51000 total -> 31000 is market movement
        { id: "mf-1", currentValue: "551000", investedAmount: "470000" },
        // +16000 EPF credit, no separate "market" component for EPF
        { id: "epf-1", currentValue: "616000", investedAmount: "616000" },
      ],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "3812000" }], // 28000 repaid
    };

    const attribution = attributeNetWorthChange(previous, current);

    expect(attribution.contributions.toFixed(2)).toBe("36000.00"); // 20000 + 16000
    expect(attribution.marketMovement.toFixed(2)).toBe("31000.00");
    expect(attribution.principalRepaid.toFixed(2)).toBe("28000.00");
    expect(attribution.other.toFixed(2)).toBe("0.00");
    expect(attribution.totalChange.toFixed(2)).toBe("95000.00");
  });

  it("the four buckets always sum to exactly the total change", () => {
    const previous: NetWorthSnapshot = {
      accounts: [{ id: "acc-1", currentBalance: "100000" }],
      assets: [{ id: "mf-1", currentValue: "200000", investedAmount: "180000" }],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "500000" }],
    };
    const current: NetWorthSnapshot = {
      accounts: [
        { id: "acc-1", currentBalance: "142300" }, // salary in, spend out — opaque
        { id: "acc-2", currentBalance: "20000" }, // brand-new account
      ],
      assets: [{ id: "mf-1", currentValue: "215500", investedAmount: "190000" }],
      liabilities: [
        { id: "loan-1", outstandingPrincipal: "493700" },
        { id: "loan-2", outstandingPrincipal: "50000" }, // brand-new liability
      ],
    };

    const attribution = attributeNetWorthChange(previous, current);
    const sumOfParts = attribution.contributions
      .plus(attribution.marketMovement)
      .plus(attribution.principalRepaid)
      .plus(attribution.other);

    expect(sumOfParts.toFixed(4)).toBe(attribution.totalChange.toFixed(4));
  });

  it("attributes a brand-new asset entirely to other, not contribution or market movement", () => {
    const previous: NetWorthSnapshot = { accounts: [], assets: [], liabilities: [] };
    const current: NetWorthSnapshot = {
      accounts: [],
      assets: [{ id: "epf-1", currentValue: "600000", investedAmount: "600000" }],
      liabilities: [],
    };

    const attribution = attributeNetWorthChange(previous, current);
    expect(attribution.other.toFixed(2)).toBe("600000.00");
    expect(attribution.contributions.toFixed(2)).toBe("0.00");
    expect(attribution.marketMovement.toFixed(2)).toBe("0.00");
    expect(attribution.totalChange.toFixed(2)).toBe("600000.00");
  });

  it("attributes a removed asset entirely to other, with the correct (negative) sign", () => {
    const previous: NetWorthSnapshot = {
      accounts: [],
      assets: [{ id: "fd-1", currentValue: "100000", investedAmount: "100000" }],
      liabilities: [],
    };
    const current: NetWorthSnapshot = { accounts: [], assets: [], liabilities: [] };

    const attribution = attributeNetWorthChange(previous, current);
    expect(attribution.other.toFixed(2)).toBe("-100000.00");
    expect(attribution.totalChange.toFixed(2)).toBe("-100000.00");
  });

  it("a new liability reduces net worth via other, with the correct sign", () => {
    const previous: NetWorthSnapshot = { accounts: [], assets: [], liabilities: [] };
    const current: NetWorthSnapshot = {
      accounts: [],
      assets: [],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "500000" }],
    };

    const attribution = attributeNetWorthChange(previous, current);
    expect(attribution.other.toFixed(2)).toBe("-500000.00");
    expect(attribution.totalChange.toFixed(2)).toBe("-500000.00");
  });

  it("treats a plain account balance change as other, since it can't be decomposed", () => {
    const previous: NetWorthSnapshot = {
      accounts: [{ id: "acc-1", currentBalance: "100000" }],
      assets: [],
      liabilities: [],
    };
    const current: NetWorthSnapshot = {
      accounts: [{ id: "acc-1", currentBalance: "145000" }],
      assets: [],
      liabilities: [],
    };

    const attribution = attributeNetWorthChange(previous, current);
    expect(attribution.other.toFixed(2)).toBe("45000.00");
    expect(attribution.contributions.toFixed(2)).toBe("0.00");
    expect(attribution.marketMovement.toFixed(2)).toBe("0.00");
  });

  it("an asset withdrawal is a negative contribution", () => {
    const previous: NetWorthSnapshot = {
      accounts: [],
      assets: [{ id: "mf-1", currentValue: "100000", investedAmount: "100000" }],
      liabilities: [],
    };
    const current: NetWorthSnapshot = {
      accounts: [],
      assets: [{ id: "mf-1", currentValue: "60000", investedAmount: "60000" }],
      liabilities: [],
    };

    const attribution = attributeNetWorthChange(previous, current);
    expect(attribution.contributions.toFixed(2)).toBe("-40000.00");
    expect(attribution.marketMovement.toFixed(2)).toBe("0.00");
  });

  it("a liability that grew (fresh borrowing on the same record) is negative principal repaid", () => {
    const previous: NetWorthSnapshot = {
      accounts: [],
      assets: [],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "100000" }],
    };
    const current: NetWorthSnapshot = {
      accounts: [],
      assets: [],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "150000" }],
    };

    const attribution = attributeNetWorthChange(previous, current);
    expect(attribution.principalRepaid.toFixed(2)).toBe("-50000.00");
    expect(attribution.totalChange.toFixed(2)).toBe("-50000.00");
  });

  it("is entirely zero for two identical snapshots", () => {
    const snapshot: NetWorthSnapshot = {
      accounts: [{ id: "acc-1", currentBalance: "100000" }],
      assets: [{ id: "mf-1", currentValue: "200000", investedAmount: "180000" }],
      liabilities: [{ id: "loan-1", outstandingPrincipal: "500000" }],
    };

    const attribution = attributeNetWorthChange(snapshot, snapshot);
    expect(attribution.totalChange.toFixed(2)).toBe("0.00");
    expect(attribution.contributions.toFixed(2)).toBe("0.00");
    expect(attribution.marketMovement.toFixed(2)).toBe("0.00");
    expect(attribution.principalRepaid.toFixed(2)).toBe("0.00");
    expect(attribution.other.toFixed(2)).toBe("0.00");
  });
});
