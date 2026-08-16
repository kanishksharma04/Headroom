import { getIstParts } from "@/lib/dates";

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** e.g. "5 Sep" */
export function formatShortDate(date: Date): string {
  const { day, month } = getIstParts(date);
  return `${day} ${MONTH_ABBR[month]}`;
}

/** e.g. "5 September 2026" */
export function formatLongDate(date: Date): string {
  const { day, month, year } = getIstParts(date);
  return `${day} ${MONTH_FULL[month]} ${year}`;
}
