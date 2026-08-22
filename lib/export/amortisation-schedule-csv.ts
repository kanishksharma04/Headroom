import { toIstDateInputValue } from "@/lib/dates";
import { toCsv } from "@/lib/export/csv";
import type { AmortisationPeriod } from "@/lib/engines/amortisation";

/** Plain decimal amounts, not Indian-formatted display strings — this is for spreadsheets and tax software, not for reading on screen. */
export function buildAmortisationScheduleCsv(periods: AmortisationPeriod[]): string {
  return toCsv(periods, [
    { header: "Period", value: (p) => String(p.period) },
    { header: "Due Date", value: (p) => toIstDateInputValue(p.dueDate) },
    { header: "Opening Balance", value: (p) => p.openingBalance.toFixed(2) },
    { header: "EMI", value: (p) => p.emi.toFixed(2) },
    { header: "Principal", value: (p) => p.principal.toFixed(2) },
    { header: "Interest", value: (p) => p.interest.toFixed(2) },
    { header: "Closing Balance", value: (p) => p.closingBalance.toFixed(2) },
  ]);
}
