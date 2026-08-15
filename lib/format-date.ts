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

const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * Extracts the calendar day/month/year a UTC instant falls on in IST.
 * Never uses the host's local timezone, which on Vercel is UTC and would
 * otherwise misdate anything within 5.5 hours either side of midnight IST.
 */
function getIstDateParts(date: Date): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: Number(lookup.day),
    month: Number(lookup.month) - 1,
    year: Number(lookup.year),
  };
}

/** e.g. "5 Sep" */
export function formatShortDate(date: Date): string {
  const { day, month } = getIstDateParts(date);
  return `${day} ${MONTH_ABBR[month]}`;
}

/** e.g. "5 September 2026" */
export function formatLongDate(date: Date): string {
  const { day, month, year } = getIstDateParts(date);
  return `${day} ${MONTH_FULL[month]} ${year}`;
}
