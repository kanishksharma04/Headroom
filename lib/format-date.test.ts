import { describe, expect, it } from "vitest";
import { formatLongDate, formatShortDate } from "@/lib/format-date";

describe("formatShortDate", () => {
  it("formats as day-month, no year", () => {
    expect(formatShortDate(new Date("2026-09-05T12:00:00.000Z"))).toBe("5 Sep");
  });

  it("resolves the IST calendar day even near UTC midnight", () => {
    // 19:00 UTC on 4 Sep is 00:30 IST on 5 Sep.
    expect(formatShortDate(new Date("2026-09-04T19:00:00.000Z"))).toBe("5 Sep");
    // 17:00 UTC on 4 Sep is 22:30 IST, still 4 Sep.
    expect(formatShortDate(new Date("2026-09-04T17:00:00.000Z"))).toBe("4 Sep");
  });
});

describe("formatLongDate", () => {
  it("formats as day, full month, year", () => {
    expect(formatLongDate(new Date("2026-09-05T12:00:00.000Z"))).toBe("5 September 2026");
  });
});
