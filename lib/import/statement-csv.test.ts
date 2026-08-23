import { describe, expect, it } from "vitest";
import {
  parseStatementAmount,
  parseStatementCsv,
  parseStatementDate,
} from "@/lib/import/statement-csv";
import { getIstParts } from "@/lib/dates";

describe("parseStatementDate", () => {
  it("parses DD/MM/YYYY", () => {
    const date = parseStatementDate("05/09/2026");
    expect(date).not.toBeNull();
    expect(getIstParts(date!)).toMatchObject({ year: 2026, month: 8, day: 5 });
  });

  it("parses DD-MM-YYYY", () => {
    const date = parseStatementDate("05-09-2026");
    expect(getIstParts(date!)).toMatchObject({ year: 2026, month: 8, day: 5 });
  });

  it("parses ISO YYYY-MM-DD", () => {
    const date = parseStatementDate("2026-09-05");
    expect(getIstParts(date!)).toMatchObject({ year: 2026, month: 8, day: 5 });
  });

  it("rejects an out-of-range month or day", () => {
    expect(parseStatementDate("32/13/2026")).toBeNull();
  });

  it("rejects unrecognised formats", () => {
    expect(parseStatementDate("5 Sep 2026")).toBeNull();
    expect(parseStatementDate("not a date")).toBeNull();
    expect(parseStatementDate("")).toBeNull();
  });
});

describe("parseStatementAmount", () => {
  it("parses a plain number", () => {
    expect(parseStatementAmount("20000")?.toFixed(2)).toBe("20000.00");
  });

  it("strips the rupee sign, commas, and whitespace", () => {
    expect(parseStatementAmount("₹ 1,20,000.50")?.toFixed(2)).toBe("120000.50");
  });

  it("returns null for a blank cell, not zero", () => {
    expect(parseStatementAmount("")).toBeNull();
    expect(parseStatementAmount("   ")).toBeNull();
  });

  it("returns null for non-numeric content", () => {
    expect(parseStatementAmount("N/A")).toBeNull();
  });
});

const HEADER = "Date,Narration,Debit,Credit,Balance";

describe("parseStatementCsv", () => {
  it("parses a well-formed statement", () => {
    const csv = [
      HEADER,
      "01/07/2026,Opening,,,100000.00",
      "05/07/2026,RENT PAYMENT,20000.00,,80000.00",
      "20/07/2026,SALARY CREDIT,,85000.00,165000.00",
    ].join("\n");

    const result = parseStatementCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[1].description).toBe("RENT PAYMENT");
    expect(result.transactions[1].debit?.toFixed(2)).toBe("20000.00");
    expect(result.transactions[1].credit).toBeNull();
    expect(result.transactions[2].credit?.toFixed(2)).toBe("85000.00");
  });

  it("matches headers case-insensitively and via common aliases", () => {
    const csv = ["date,particulars,withdrawal,deposit,closing balance", "01/07/2026,X,100,,900"].join(
      "\n",
    );
    const result = parseStatementCsv(csv);
    expect(result.ok).toBe(true);
  });

  it("handles a quoted description containing a comma", () => {
    const csv = [HEADER, '01/07/2026,"Payment, ref 123",100.00,,900.00'].join("\n");
    const result = parseStatementCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transactions[0].description).toBe("Payment, ref 123");
  });

  it("skips blank lines", () => {
    const csv = [HEADER, "01/07/2026,X,100,,900", "", "02/07/2026,Y,,200,1100"].join("\n");
    const result = parseStatementCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transactions).toHaveLength(2);
  });

  it("errors when there are no data rows", () => {
    const result = parseStatementCsv(HEADER);
    expect(result.ok).toBe(false);
  });

  it("errors when required columns are missing", () => {
    const result = parseStatementCsv(["Date,Amount", "01/07/2026,100"].join("\n"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Date");
  });

  it("errors with the row number when a date can't be parsed", () => {
    const csv = [HEADER, "01/07/2026,X,100,,900", "not-a-date,Y,,200,1100"].join("\n");
    const result = parseStatementCsv(csv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Row 3");
  });
});
