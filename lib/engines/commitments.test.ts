import { describe, expect, it } from "vitest";
import { deriveEmiCommitmentFields, generateOccurrences } from "@/lib/engines/commitments";
import { getIstParts, istDate } from "@/lib/dates";

function dates(occurrences: { date: Date }[]): string[] {
  return occurrences.map((o) => {
    const { year, month, day } = getIstParts(o.date);
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}

describe("generateOccurrences — monthly", () => {
  it("a commitment anchored on the 31st resolves correctly in February", () => {
    const commitment = {
      id: "c1",
      name: "Rent",
      direction: "OUTFLOW" as const,
      amount: "25000",
      frequency: "MONTHLY" as const,
      anchorDate: istDate(2026, 0, 31), // 31 Jan 2026
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };

    const occurrences = generateOccurrences(commitment, {
      from: istDate(2026, 0, 1),
      to: istDate(2026, 3, 30), // through end of April
    });

    expect(dates(occurrences)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("resolves correctly across a leap-year February", () => {
    const commitment = {
      id: "c1",
      name: "Rent",
      direction: "OUTFLOW" as const,
      amount: "25000",
      frequency: "MONTHLY" as const,
      anchorDate: istDate(2028, 0, 31),
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };

    const occurrences = generateOccurrences(commitment, {
      from: istDate(2028, 1, 1),
      to: istDate(2028, 1, 29),
    });

    expect(dates(occurrences)).toEqual(["2028-02-29"]);
  });

  it("uses an explicit dayOfMonth over the anchor's own day when provided", () => {
    const commitment = {
      id: "c1",
      name: "SIP",
      direction: "OUTFLOW" as const,
      amount: "10000",
      frequency: "MONTHLY" as const,
      anchorDate: istDate(2026, 0, 1),
      dayOfMonth: 5,
      endDate: null,
      isActive: true,
    };

    const occurrences = generateOccurrences(commitment, {
      from: istDate(2026, 0, 1),
      to: istDate(2026, 1, 28),
    });

    expect(dates(occurrences)).toEqual(["2026-01-05", "2026-02-05"]);
  });
});

describe("generateOccurrences — quarterly", () => {
  it("generates exactly the right occurrences across a 12-month window", () => {
    const commitment = {
      id: "c1",
      name: "Insurance premium",
      direction: "OUTFLOW" as const,
      amount: "6000",
      frequency: "QUARTERLY" as const,
      anchorDate: istDate(2026, 0, 15), // 15 Jan 2026
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };

    const occurrences = generateOccurrences(commitment, {
      from: istDate(2026, 0, 1),
      to: istDate(2026, 11, 31),
    });

    expect(dates(occurrences)).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  it("a window that starts mid-cycle only returns occurrences from that point on", () => {
    const commitment = {
      id: "c1",
      name: "Insurance premium",
      direction: "OUTFLOW" as const,
      amount: "6000",
      frequency: "QUARTERLY" as const,
      anchorDate: istDate(2026, 0, 15),
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };

    const occurrences = generateOccurrences(commitment, {
      from: istDate(2026, 4, 1), // 1 May 2026 — after the April occurrence
      to: istDate(2026, 11, 31),
    });

    expect(dates(occurrences)).toEqual(["2026-07-15", "2026-10-15"]);
  });
});

describe("generateOccurrences — half-yearly and annual", () => {
  it("half-yearly steps six months at a time", () => {
    const commitment = {
      id: "c1",
      name: "Term insurance",
      direction: "OUTFLOW" as const,
      amount: "15000",
      frequency: "HALF_YEARLY" as const,
      anchorDate: istDate(2026, 2, 1),
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };
    const occurrences = generateOccurrences(commitment, {
      from: istDate(2026, 0, 1),
      to: istDate(2027, 11, 31),
    });
    expect(dates(occurrences)).toEqual(["2026-03-01", "2026-09-01", "2027-03-01", "2027-09-01"]);
  });

  it("annual steps twelve months at a time", () => {
    const commitment = {
      id: "c1",
      name: "Car insurance",
      direction: "OUTFLOW" as const,
      amount: "18000",
      frequency: "ANNUAL" as const,
      anchorDate: istDate(2026, 5, 10),
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };
    const occurrences = generateOccurrences(commitment, {
      from: istDate(2026, 0, 1),
      to: istDate(2029, 11, 31),
    });
    expect(dates(occurrences)).toEqual(["2026-06-10", "2027-06-10", "2028-06-10", "2029-06-10"]);
  });
});

describe("generateOccurrences — one-time", () => {
  it("returns a single occurrence when the anchor falls inside the window", () => {
    const commitment = {
      id: "c1",
      name: "Laptop purchase",
      direction: "OUTFLOW" as const,
      amount: "120000",
      frequency: "ONE_TIME" as const,
      anchorDate: istDate(2026, 7, 20),
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };
    expect(
      dates(generateOccurrences(commitment, { from: istDate(2026, 7, 1), to: istDate(2026, 7, 31) })),
    ).toEqual(["2026-08-20"]);
  });

  it("returns nothing when the anchor falls outside the window", () => {
    const commitment = {
      id: "c1",
      name: "Laptop purchase",
      direction: "OUTFLOW" as const,
      amount: "120000",
      frequency: "ONE_TIME" as const,
      anchorDate: istDate(2026, 7, 20),
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };
    expect(
      dates(generateOccurrences(commitment, { from: istDate(2026, 8, 1), to: istDate(2026, 8, 30) })),
    ).toEqual([]);
  });
});

describe("generateOccurrences — endDate and isActive", () => {
  it("stops generating once endDate has passed", () => {
    const commitment = {
      id: "c1",
      name: "Gym membership",
      direction: "OUTFLOW" as const,
      amount: "2000",
      frequency: "MONTHLY" as const,
      anchorDate: istDate(2026, 0, 1),
      dayOfMonth: null,
      endDate: istDate(2026, 2, 1), // ends 1 Mar
      isActive: true,
    };
    expect(
      dates(generateOccurrences(commitment, { from: istDate(2026, 0, 1), to: istDate(2026, 5, 30) })),
    ).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("returns nothing for an inactive commitment", () => {
    const commitment = {
      id: "c1",
      name: "Cancelled subscription",
      direction: "OUTFLOW" as const,
      amount: "500",
      frequency: "MONTHLY" as const,
      anchorDate: istDate(2026, 0, 1),
      dayOfMonth: null,
      endDate: null,
      isActive: false,
    };
    expect(
      dates(generateOccurrences(commitment, { from: istDate(2026, 0, 1), to: istDate(2026, 5, 30) })),
    ).toEqual([]);
  });

  it("never generates an occurrence before the anchor date, even for a window that starts earlier", () => {
    const commitment = {
      id: "c1",
      name: "New SIP",
      direction: "OUTFLOW" as const,
      amount: "5000",
      frequency: "MONTHLY" as const,
      anchorDate: istDate(2026, 5, 15),
      dayOfMonth: null,
      endDate: null,
      isActive: true,
    };
    expect(
      dates(generateOccurrences(commitment, { from: istDate(2026, 0, 1), to: istDate(2026, 5, 30) })),
    ).toEqual(["2026-06-15"]);
  });
});

describe("deriveEmiCommitmentFields", () => {
  it("anchors the first instalment on the EMI day of month in the loan's start month", () => {
    const fields = deriveEmiCommitmentFields({
      emiAmount: "34966.51",
      emiDayOfMonth: 5,
      startDate: istDate(2026, 7, 15), // 15 Aug 2026
      tenureMonths: 240,
    });

    expect(getIstParts(fields.anchorDate)).toMatchObject({ year: 2026, month: 7, day: 5 });
    expect(fields.dayOfMonth).toBe(5);
    expect(fields.amount.toFixed(2)).toBe("34966.51");
  });

  it("ends with the loan's original final instalment", () => {
    const fields = deriveEmiCommitmentFields({
      emiAmount: "34966.51",
      emiDayOfMonth: 5,
      startDate: istDate(2026, 7, 15),
      tenureMonths: 240,
    });

    // Period 240 falls 239 months after the anchor.
    expect(getIstParts(fields.endDate)).toMatchObject({ year: 2046, month: 6, day: 5 });
  });

  it("stays synchronised: recomputing after a rate/EMI change reflects the new EMI amount", () => {
    const before = deriveEmiCommitmentFields({
      emiAmount: "34966.51",
      emiDayOfMonth: 5,
      startDate: istDate(2026, 7, 15),
      tenureMonths: 240,
    });
    // After a REDUCE_EMI prepayment, the loan's stated EMI amount drops.
    const after = deriveEmiCommitmentFields({
      emiAmount: "33183.12",
      emiDayOfMonth: 5,
      startDate: istDate(2026, 7, 15),
      tenureMonths: 240,
    });

    expect(before.amount.toFixed(2)).toBe("34966.51");
    expect(after.amount.toFixed(2)).toBe("33183.12");
    expect(after.anchorDate.getTime()).toBe(before.anchorDate.getTime());
  });

  it("clamps the EMI day of month when the start month is shorter", () => {
    const fields = deriveEmiCommitmentFields({
      emiAmount: "10000",
      emiDayOfMonth: 31,
      startDate: istDate(2026, 1, 10), // February
      tenureMonths: 12,
    });
    expect(getIstParts(fields.anchorDate)).toMatchObject({ year: 2026, month: 1, day: 28 });
  });
});
