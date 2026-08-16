import { describe, expect, it } from "vitest";
import { calculateEmi, generateAmortisationSchedule } from "@/lib/engines/amortisation";
import { getIstParts, istDate } from "@/lib/dates";

/**
 * Every EMI figure below was independently cross-checked: once via the
 * standard reducing-balance formula in plain floating point, and once via
 * decimal.js — both agree to the rupee. Schedule totals were computed by
 * hand-running the same reducing-balance algorithm the engine implements.
 */
describe("calculateEmi", () => {
  it("matches published bank EMI figures", () => {
    expect(calculateEmi("4000000", "8.6", 240).toFixed(2)).toBe("34966.51");
    expect(calculateEmi("800000", "10.5", 60).toFixed(2)).toBe("17195.12");
    expect(calculateEmi("2500000", "9.15", 180).toFixed(2)).toBe("25580.23");
  });

  it("handles a zero-interest loan as a plain equal split", () => {
    expect(calculateEmi("120000", "0", 12).toFixed(2)).toBe("10000.00");
  });

  it("handles a single-month loan (principal + one month's interest)", () => {
    expect(calculateEmi("100000", "12", 1).toFixed(2)).toBe("101000.00");
  });

  it("handles a high-rate short-tenure personal loan", () => {
    expect(calculateEmi("200000", "24", 12).toFixed(2)).toBe("18911.92");
  });

  it("rejects a non-positive tenure", () => {
    expect(() => calculateEmi("100000", "10", 0)).toThrow();
  });
});

describe("generateAmortisationSchedule", () => {
  const firstDueDate = istDate(2026, 8, 5); // 5 Sep 2026

  it("40L @ 8.6% / 240m matches the hand-verified schedule exactly", () => {
    const schedule = generateAmortisationSchedule({
      principal: "4000000",
      annualRatePercent: "8.6",
      tenureMonths: 240,
      firstDueDate,
    });

    expect(schedule.emi.toFixed(2)).toBe("34966.51");
    expect(schedule.totalInterest.toFixed(2)).toBe("4391962.56");
    expect(schedule.totalPaid.toFixed(2)).toBe("8391962.56");
    expect(schedule.periods).toHaveLength(240);

    const p1 = schedule.periods[0];
    expect(p1.openingBalance.toFixed(2)).toBe("4000000.00");
    expect(p1.interest.toFixed(2)).toBe("28666.67");
    expect(p1.principal.toFixed(2)).toBe("6299.84");
    expect(p1.closingBalance.toFixed(2)).toBe("3993700.16");

    const last = schedule.periods[239];
    expect(last.openingBalance.toFixed(2)).toBe("34717.86");
    expect(last.interest.toFixed(2)).toBe("248.81");
    expect(last.principal.toFixed(2)).toBe("34717.86");
    expect(last.emi.toFixed(2)).toBe("34966.67");
    expect(last.closingBalance.toFixed(2)).toBe("0.00");
  });

  it("8L @ 10.5% / 60m matches the hand-verified schedule", () => {
    const schedule = generateAmortisationSchedule({
      principal: "800000",
      annualRatePercent: "10.5",
      tenureMonths: 60,
      firstDueDate,
    });

    expect(schedule.emi.toFixed(2)).toBe("17195.12");
    expect(schedule.totalInterest.toFixed(2)).toBe("231707.22");
    expect(schedule.totalPaid.toFixed(2)).toBe("1031707.22");

    const last = schedule.periods[59];
    expect(last.emi.toFixed(2)).toBe("17195.14");
    expect(last.closingBalance.toFixed(2)).toBe("0.00");
  });

  it("25L @ 9.15% / 180m matches the hand-verified schedule", () => {
    const schedule = generateAmortisationSchedule({
      principal: "2500000",
      annualRatePercent: "9.15",
      tenureMonths: 180,
      firstDueDate,
    });

    expect(schedule.emi.toFixed(2)).toBe("25580.23");
    expect(schedule.totalInterest.toFixed(2)).toBe("2104440.78");
    expect(schedule.totalPaid.toFixed(2)).toBe("4604440.78");

    const last = schedule.periods[179];
    expect(last.emi.toFixed(2)).toBe("25579.61");
    expect(last.closingBalance.toFixed(2)).toBe("0.00");
  });

  it("zero-interest loan has no interest in any period", () => {
    const schedule = generateAmortisationSchedule({
      principal: "120000",
      annualRatePercent: "0",
      tenureMonths: 12,
      firstDueDate,
    });

    expect(schedule.totalInterest.toFixed(2)).toBe("0.00");
    expect(schedule.totalPaid.toFixed(2)).toBe("120000.00");
    for (const period of schedule.periods) {
      expect(period.interest.toFixed(2)).toBe("0.00");
      expect(period.emi.toFixed(2)).toBe("10000.00");
    }
    expect(schedule.periods[11].closingBalance.toFixed(2)).toBe("0.00");
  });

  it("a single-month loan pays principal plus one month's interest in one instalment", () => {
    const schedule = generateAmortisationSchedule({
      principal: "100000",
      annualRatePercent: "12",
      tenureMonths: 1,
      firstDueDate,
    });

    expect(schedule.periods).toHaveLength(1);
    const only = schedule.periods[0];
    expect(only.interest.toFixed(2)).toBe("1000.00");
    expect(only.principal.toFixed(2)).toBe("100000.00");
    expect(only.emi.toFixed(2)).toBe("101000.00");
    expect(only.closingBalance.toFixed(2)).toBe("0.00");
    expect(schedule.totalPaid.toFixed(2)).toBe("101000.00");
  });

  it("a high-rate short-tenure personal loan matches the hand-verified schedule", () => {
    const schedule = generateAmortisationSchedule({
      principal: "200000",
      annualRatePercent: "24",
      tenureMonths: 12,
      firstDueDate,
    });

    expect(schedule.emi.toFixed(2)).toBe("18911.92");
    expect(schedule.totalInterest.toFixed(2)).toBe("26943.04");
    expect(schedule.totalPaid.toFixed(2)).toBe("226943.04");
    expect(schedule.periods[11].closingBalance.toFixed(2)).toBe("0.00");
  });

  it("every fixture closes at exactly zero, never negative, never a stray paisa", () => {
    const fixtures = [
      { principal: "4000000", annualRatePercent: "8.6", tenureMonths: 240 },
      { principal: "800000", annualRatePercent: "10.5", tenureMonths: 60 },
      { principal: "2500000", annualRatePercent: "9.15", tenureMonths: 180 },
      { principal: "120000", annualRatePercent: "0", tenureMonths: 12 },
      { principal: "100000", annualRatePercent: "12", tenureMonths: 1 },
      { principal: "200000", annualRatePercent: "24", tenureMonths: 12 },
    ];

    for (const fixture of fixtures) {
      const schedule = generateAmortisationSchedule({ ...fixture, firstDueDate });
      const last = schedule.periods[schedule.periods.length - 1];
      expect(last.closingBalance.toFixed(4)).toBe("0.0000");
      // totalPaid must equal principal + totalInterest exactly.
      expect(schedule.totalPaid.toFixed(2)).toBe(
        schedule.totalInterest.plus(fixture.principal).toFixed(2),
      );
    }
  });

  it("steps due dates one calendar month at a time, clamping at month-end", () => {
    const schedule = generateAmortisationSchedule({
      principal: "100000",
      annualRatePercent: "10",
      tenureMonths: 3,
      firstDueDate: istDate(2026, 0, 31), // 31 Jan 2026
    });

    expect(getIstParts(schedule.periods[0].dueDate)).toMatchObject({ year: 2026, month: 0, day: 31 });
    expect(getIstParts(schedule.periods[1].dueDate)).toMatchObject({ year: 2026, month: 1, day: 28 });
    expect(getIstParts(schedule.periods[2].dueDate)).toMatchObject({ year: 2026, month: 2, day: 31 });
  });

  it("rejects a non-positive tenure", () => {
    expect(() =>
      generateAmortisationSchedule({
        principal: "100000",
        annualRatePercent: "10",
        tenureMonths: 0,
        firstDueDate,
      }),
    ).toThrow();
  });
});
