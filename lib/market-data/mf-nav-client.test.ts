import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLatestMfNav } from "@/lib/market-data/mf-nav-client";
import { istDate } from "@/lib/dates";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("fetchLatestMfNav", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses the latest NAV and its AMFI-format date into a real IST date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          meta: { scheme_name: "Test Fund - Direct Plan" },
          data: [
            { date: "24-08-2026", nav: "106.91640" },
            { date: "21-08-2026", nav: "106.88210" },
          ],
        }),
      ),
    );

    const result = await fetchLatestMfNav("119551");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.navPerUnit.toString()).toBe("106.9164");
    expect(result.schemeName).toBe("Test Fund - Direct Plan");
    expect(result.navDate.getTime()).toBe(istDate(2026, 7, 24).getTime());
  });

  it("uses only the first (latest) data point, ignoring older history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          meta: { scheme_name: "Test Fund" },
          data: [
            { date: "24-08-2026", nav: "100" },
            { date: "23-08-2026", nav: "999" },
          ],
        }),
      ),
    );

    const result = await fetchLatestMfNav("1");
    if (!result.ok) throw new Error("expected ok result");
    expect(result.navPerUnit.toString()).toBe("100");
  });

  it("reports failure for an unknown scheme code — mirrors mfapi.in's real shape (empty data, empty meta, still HTTP 200)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          meta: { fund_house: "", scheme_type: "", scheme_category: "", scheme_code: 0, scheme_name: "" },
          data: [],
          status: "SUCCESS",
        }),
      ),
    );

    const result = await fetchLatestMfNav("9999999999");
    expect(result).toEqual({ ok: false, error: "No AMFI scheme found for code 9999999999." });
  });

  it("reports failure when the HTTP response itself isn't ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 503)));

    const result = await fetchLatestMfNav("119551");
    expect(result).toEqual({ ok: false, error: "NAV lookup failed (HTTP 503)." });
  });

  it("reports failure rather than throwing when the network request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await fetchLatestMfNav("119551");
    expect(result.ok).toBe(false);
  });

  it("reports failure when the response body isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("not json");
        },
      } as unknown as Response),
    );

    const result = await fetchLatestMfNav("119551");
    expect(result.ok).toBe(false);
  });

  it("reports failure when the NAV date isn't in AMFI's DD-MM-YYYY format", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          meta: { scheme_name: "Test Fund" },
          data: [{ date: "2026-08-24", nav: "100" }],
        }),
      ),
    );

    const result = await fetchLatestMfNav("119551");
    expect(result.ok).toBe(false);
  });
});
