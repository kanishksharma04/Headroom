import { toIstDateInputValue } from "@/lib/dates";
import { toCsv } from "@/lib/export/csv";
import type { NetWorthHistoryPoint } from "@/lib/services/networth-snapshot-service";

/** Plain decimal amounts, not Indian-formatted display strings — this is for spreadsheets and tax software, not for reading on screen. */
export function buildNetWorthHistoryCsv(points: NetWorthHistoryPoint[]): string {
  return toCsv(points, [
    { header: "Date", value: (p) => toIstDateInputValue(p.date) },
    { header: "Net Worth", value: (p) => p.netWorth.toFixed(2) },
    { header: "Total Assets", value: (p) => p.totalAssets.toFixed(2) },
    { header: "Total Liabilities", value: (p) => p.totalLiabilities.toFixed(2) },
  ]);
}
