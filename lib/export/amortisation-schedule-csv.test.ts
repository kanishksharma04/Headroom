import { describe, expect, it } from "vitest";
import { buildAmortisationScheduleCsv } from "@/lib/export/amortisation-schedule-csv";
import { generateAmortisationSchedule } from "@/lib/engines/amortisation";
import { istDate } from "@/lib/dates";

describe("buildAmortisationScheduleCsv", () => {
  it("renders one plain-decimal row per period, matching the engine's own numbers", () => {
    // 0% interest, 3 months: a trivial, hand-verifiable 3-way split of 30000.
    const schedule = generateAmortisationSchedule({
      principal: "30000",
      annualRatePercent: "0",
      tenureMonths: 3,
      firstDueDate: istDate(2026, 0, 5),
    });

    const csv = buildAmortisationScheduleCsv(schedule.periods);

    expect(csv).toBe(
      "Period,Due Date,Opening Balance,EMI,Principal,Interest,Closing Balance\r\n" +
        "1,2026-01-05,30000.00,10000.00,10000.00,0.00,20000.00\r\n" +
        "2,2026-02-05,20000.00,10000.00,10000.00,0.00,10000.00\r\n" +
        "3,2026-03-05,10000.00,10000.00,10000.00,0.00,0.00\r\n",
    );
  });

  it("emits just the header for an empty schedule", () => {
    expect(buildAmortisationScheduleCsv([])).toBe(
      "Period,Due Date,Opening Balance,EMI,Principal,Interest,Closing Balance\r\n",
    );
  });
});
