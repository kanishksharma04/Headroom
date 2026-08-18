import { addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const IST_TIME_ZONE = "Asia/Kolkata";

export type IstParts = {
  year: number;
  /** 0-indexed, matching JavaScript's Date convention. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Extracts the IST calendar/clock components a UTC instant falls on. */
export function getIstParts(date: Date): IstParts {
  const zoned = toZonedTime(date, IST_TIME_ZONE);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth(),
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
    second: zoned.getSeconds(),
  };
}

/**
 * Builds the UTC instant corresponding to a given IST wall-clock moment.
 * `month` is 0-indexed to match JavaScript's Date convention.
 */
export function istDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return fromZonedTime(new Date(year, month, day, hour, minute, second), IST_TIME_ZONE);
}

/** The UTC instant that is midnight IST on the day the given instant falls on, in IST. */
export function startOfIstDay(date: Date): Date {
  const { year, month, day } = getIstParts(date);
  return istDate(year, month, day);
}

/** Midnight IST today. */
export function todayIst(): Date {
  return startOfIstDay(new Date());
}

/** Formats a date as `YYYY-MM-DD` in IST, for `<input type="date">` default values. */
export function toIstDateInputValue(date: Date): string {
  const { year, month, day } = getIstParts(date);
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The last valid day of a given month, e.g. (2026, 1) -> 28 for February,
 * (2026, 3) -> 30 for April. `month` is 0-indexed.
 */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of this one — timezone-
  // independent calendar arithmetic, no IST conversion needed.
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Resolves a requested day-of-month (e.g. 31, for an EMI or commitment
 * anchored on the month's last working day) against a specific month,
 * clamping to that month's last real day. (2026, 1, 31) -> 28.
 */
export function resolveDayOfMonth(year: number, month: number, dayOfMonth: number): number {
  return Math.min(dayOfMonth, daysInMonth(year, month));
}

/** The IST date for a requested day-of-month in a given month, clamped if needed. */
export function resolveIstDateForDayOfMonth(year: number, month: number, dayOfMonth: number): Date {
  return istDate(year, month, resolveDayOfMonth(year, month, dayOfMonth));
}

/**
 * Adds calendar months to a date, clamping the day-of-month to the target
 * month's last day when it would otherwise overflow (31 Jan + 1 month -> 28/29
 * Feb, not 3 Mar). Time-of-day (in IST) is preserved.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const { year, month, day, hour, minute, second } = getIstParts(date);
  const totalMonths = year * 12 + month + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const resolvedDay = resolveDayOfMonth(targetYear, targetMonth, day);
  return istDate(targetYear, targetMonth, resolvedDay, hour, minute, second);
}

export type FinancialYear = {
  /** Calendar year the FY starts in, e.g. 2026 for FY26-27 (1 Apr 2026 – 31 Mar 2027). */
  startYear: number;
  endYear: number;
  /** e.g. "FY26-27" */
  label: string;
};

/** India's financial year runs 1 April – 31 March. */
export function financialYearOf(date: Date): FinancialYear {
  const { year, month } = getIstParts(date);
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return { startYear, endYear, label: `FY${String(startYear).slice(-2)}-${String(endYear).slice(-2)}` };
}

/**
 * Bounds of the financial year the given date falls in, as a half-open
 * interval [start, nextStart) — avoids end-of-day/millisecond edge cases.
 */
export function financialYearBounds(date: Date): { start: Date; nextStart: Date } {
  const { startYear, endYear } = financialYearOf(date);
  return {
    start: istDate(startYear, 3, 1),
    nextStart: istDate(endYear, 3, 1),
  };
}

/** The day of the week (0 = Sunday .. 6 = Saturday) the instant falls on, in IST. */
export function getIstDayOfWeek(date: Date): number {
  return toZonedTime(date, IST_TIME_ZONE).getDay();
}

/**
 * Whether the given instant falls on a Monday–Friday in IST. Does not know
 * about Indian bank or market holidays — only excludes weekends.
 */
export function isBusinessDay(date: Date): boolean {
  const day = getIstDayOfWeek(date);
  return day !== 0 && day !== 6;
}

/** The next Monday–Friday strictly after the given date, in IST. */
export function nextBusinessDay(date: Date): Date {
  let next = addDays(startOfIstDay(date), 1);
  while (!isBusinessDay(next)) {
    next = addDays(next, 1);
  }
  return next;
}

/** The previous Monday–Friday strictly before the given date, in IST. */
export function previousBusinessDay(date: Date): Date {
  let previous = addDays(startOfIstDay(date), -1);
  while (!isBusinessDay(previous)) {
    previous = addDays(previous, -1);
  }
  return previous;
}
