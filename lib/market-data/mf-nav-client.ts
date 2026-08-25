import Decimal from "decimal.js";
import { istDate } from "@/lib/dates";

export type MfNavLookup =
  | { ok: true; navPerUnit: Decimal; navDate: Date; schemeName: string }
  | { ok: false; error: string };

const AMFI_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

/** AMFI's NAV history reports dates as "DD-MM-YYYY", not ISO. */
function parseAmfiDate(value: string): Date | null {
  const match = AMFI_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  return istDate(Number(year), Number(month) - 1, Number(day));
}

type MfApiResponse = {
  meta?: { scheme_name?: string };
  data?: { date?: string; nav?: string }[];
};

/**
 * Looks up a mutual fund's latest declared NAV from api.mfapi.in — a free,
 * unauthenticated mirror of AMFI's daily scheme-wise NAV data, keyed by
 * AMFI scheme code. Never throws: a network failure, malformed response,
 * or unknown scheme code all come back as `{ ok: false }` with a
 * user-facing message, so one bad scheme code can't crash a batch sync
 * partway through the rest of a user's — or another user's — assets.
 */
export async function fetchLatestMfNav(schemeCode: string): Promise<MfNavLookup> {
  let response: Response;
  try {
    response = await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}`);
  } catch {
    return { ok: false, error: "Couldn't reach the NAV data source. Try again shortly." };
  }

  if (!response.ok) {
    return { ok: false, error: `NAV lookup failed (HTTP ${response.status}).` };
  }

  let body: MfApiResponse;
  try {
    body = (await response.json()) as MfApiResponse;
  } catch {
    return { ok: false, error: "The NAV data source returned an unexpected response." };
  }

  const latest = body.data?.[0];
  if (!body.meta?.scheme_name || !latest?.nav || !latest?.date) {
    return { ok: false, error: `No AMFI scheme found for code ${schemeCode}.` };
  }

  const navDate = parseAmfiDate(latest.date);
  if (!navDate) {
    return { ok: false, error: "The NAV data source returned an unexpected date format." };
  }

  return { ok: true, navPerUnit: new Decimal(latest.nav), navDate, schemeName: body.meta.scheme_name };
}
