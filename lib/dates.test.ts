import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  daysInMonth,
  financialYearBounds,
  financialYearOf,
  getIstParts,
  isBusinessDay,
  istDate,
  nextBusinessDay,
  previousBusinessDay,
  resolveDayOfMonth,
  resolveIstDateForDayOfMonth,
  startOfIstDay,
  todayIst,
} from "@/lib/dates";

describe("getIstParts / istDate round-trip", () => {
  it("extracts the correct IST calendar day even near UTC midnight", () => {
    // 19:00 UTC on 4 Sep 2026 is 00:30 IST on 5 Sep.
    const parts = getIstParts(new Date("2026-09-04T19:00:00.000Z"));
    expect(parts).toMatchObject({ year: 2026, month: 8, day: 5, hour: 0, minute: 30 });
  });

  it("builds the correct UTC instant from IST wall-clock components", () => {
    const date = istDate(2026, 8, 5, 0, 30, 0);
    expect(date.toISOString()).toBe("2026-09-04T19:00:00.000Z");
  });
});

describe("startOfIstDay / todayIst", () => {
  it("returns midnight IST for the given instant", () => {
    const start = startOfIstDay(new Date("2026-09-05T18:45:00.000Z"));
    expect(getIstParts(start)).toMatchObject({ hour: 0, minute: 0, second: 0 });
  });

  it("todayIst is idempotent under startOfIstDay", () => {
    const today = todayIst();
    expect(startOfIstDay(today).getTime()).toBe(today.getTime());
  });
});

describe("daysInMonth / resolveDayOfMonth", () => {
  it("knows February's length, leap and non-leap", () => {
    expect(daysInMonth(2026, 1)).toBe(28); // 2026 is not a leap year
    expect(daysInMonth(2028, 1)).toBe(29); // 2028 is
  });

  it("resolves an in-range day unchanged", () => {
    expect(resolveDayOfMonth(2026, 7, 15)).toBe(15);
  });

  it("clamps day 31 to February's actual last day", () => {
    expect(resolveDayOfMonth(2026, 1, 31)).toBe(28);
    expect(resolveDayOfMonth(2028, 1, 31)).toBe(29);
  });

  it("clamps day 31 in a 30-day month", () => {
    expect(resolveDayOfMonth(2026, 3, 31)).toBe(30); // April
  });

  it("resolveIstDateForDayOfMonth produces the clamped IST date", () => {
    const date = resolveIstDateForDayOfMonth(2026, 1, 31);
    expect(getIstParts(date)).toMatchObject({ year: 2026, month: 1, day: 28 });
  });
});

describe("addMonthsClamped", () => {
  it("adds whole months when the day exists in the target month", () => {
    const result = addMonthsClamped(istDate(2026, 0, 15), 2);
    expect(getIstParts(result)).toMatchObject({ year: 2026, month: 2, day: 15 });
  });

  it("clamps 31 Jan + 1 month to 28 Feb, not 3 Mar", () => {
    const result = addMonthsClamped(istDate(2026, 0, 31), 1);
    expect(getIstParts(result)).toMatchObject({ year: 2026, month: 1, day: 28 });
  });

  it("clamps 31 Jan + 1 month to 29 Feb in a leap year", () => {
    const result = addMonthsClamped(istDate(2028, 0, 31), 1);
    expect(getIstParts(result)).toMatchObject({ year: 2028, month: 1, day: 29 });
  });

  it("rolls over the year boundary", () => {
    const result = addMonthsClamped(istDate(2026, 11, 15), 1);
    expect(getIstParts(result)).toMatchObject({ year: 2027, month: 0, day: 15 });
  });

  it("supports negative months", () => {
    const result = addMonthsClamped(istDate(2026, 0, 15), -1);
    expect(getIstParts(result)).toMatchObject({ year: 2025, month: 11, day: 15 });
  });
});

describe("financial year", () => {
  it("a date in April starts a new financial year", () => {
    expect(financialYearOf(istDate(2026, 3, 1)).label).toBe("FY26-27");
  });

  it("a date in March belongs to the financial year that started the previous April", () => {
    expect(financialYearOf(istDate(2026, 2, 31)).label).toBe("FY25-26");
  });

  it("bounds form a half-open interval covering exactly the financial year", () => {
    const { start, nextStart } = financialYearBounds(istDate(2026, 5, 1));
    expect(getIstParts(start)).toMatchObject({ year: 2026, month: 3, day: 1, hour: 0 });
    expect(getIstParts(nextStart)).toMatchObject({ year: 2027, month: 3, day: 1, hour: 0 });
  });
});

describe("business days", () => {
  it("identifies weekends correctly", () => {
    // 14/15/16/17 Aug 2026 are Fri/Sat/Sun/Mon.
    expect(isBusinessDay(istDate(2026, 7, 14))).toBe(true);
    expect(isBusinessDay(istDate(2026, 7, 15))).toBe(false);
    expect(isBusinessDay(istDate(2026, 7, 16))).toBe(false);
    expect(isBusinessDay(istDate(2026, 7, 17))).toBe(true);
  });

  it("nextBusinessDay skips a weekend", () => {
    // Friday 14 Aug 2026 -> next business day is Monday 17 Aug.
    const next = nextBusinessDay(istDate(2026, 7, 14));
    expect(getIstParts(next)).toMatchObject({ year: 2026, month: 7, day: 17 });
  });

  it("previousBusinessDay skips a weekend", () => {
    // Monday 17 Aug 2026 -> previous business day is Friday 14 Aug.
    const previous = previousBusinessDay(istDate(2026, 7, 17));
    expect(getIstParts(previous)).toMatchObject({ year: 2026, month: 7, day: 14 });
  });
});
