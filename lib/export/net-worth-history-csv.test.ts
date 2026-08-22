import { describe, expect, it } from "vitest";
import { buildNetWorthHistoryCsv } from "@/lib/export/net-worth-history-csv";
import { toMoney } from "@/lib/money";
import { istDate } from "@/lib/dates";

describe("buildNetWorthHistoryCsv", () => {
  it("renders one plain-decimal row per snapshot, in the given order", () => {
    const csv = buildNetWorthHistoryCsv([
      {
        date: istDate(2026, 0, 1),
        netWorth: toMoney("500000"),
        totalAssets: toMoney("620000"),
        totalLiabilities: toMoney("120000"),
      },
      {
        date: istDate(2026, 1, 1),
        netWorth: toMoney("510000.5"),
        totalAssets: toMoney("630000"),
        totalLiabilities: toMoney("119999.5"),
      },
    ]);

    expect(csv).toBe(
      "Date,Net Worth,Total Assets,Total Liabilities\r\n" +
        "2026-01-01,500000.00,620000.00,120000.00\r\n" +
        "2026-02-01,510000.50,630000.00,119999.50\r\n",
    );
  });

  it("emits just the header when there is no history yet", () => {
    expect(buildNetWorthHistoryCsv([])).toBe("Date,Net Worth,Total Assets,Total Liabilities\r\n");
  });
});
