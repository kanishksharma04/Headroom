import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/export/csv";

type Row = { name: string; amount: string };

describe("toCsv", () => {
  it("renders a header line and one line per row", () => {
    const csv = toCsv<Row>(
      [
        { name: "Rent", amount: "20000.00" },
        { name: "SIP", amount: "5000.00" },
      ],
      [
        { header: "Name", value: (r) => r.name },
        { header: "Amount", value: (r) => r.amount },
      ],
    );
    expect(csv).toBe("Name,Amount\r\nRent,20000.00\r\nSIP,5000.00\r\n");
  });

  it("emits just the header, CRLF-terminated, for an empty row set", () => {
    const csv = toCsv<Row>([], [{ header: "Name", value: (r) => r.name }]);
    expect(csv).toBe("Name\r\n");
  });

  it("quotes a field containing a comma", () => {
    const csv = toCsv<Row>(
      [{ name: "Rent, Utilities", amount: "1" }],
      [{ header: "Name", value: (r) => r.name }],
    );
    expect(csv).toBe('Name\r\n"Rent, Utilities"\r\n');
  });

  it("quotes a field containing a double quote and doubles the quote", () => {
    const csv = toCsv<Row>(
      [{ name: 'The "Big" Loan', amount: "1" }],
      [{ header: "Name", value: (r) => r.name }],
    );
    expect(csv).toBe('Name\r\n"The ""Big"" Loan"\r\n');
  });

  it("quotes a field containing a newline", () => {
    const csv = toCsv<Row>(
      [{ name: "Line1\nLine2", amount: "1" }],
      [{ header: "Name", value: (r) => r.name }],
    );
    expect(csv).toBe('Name\r\n"Line1\nLine2"\r\n');
  });

  it("does not quote a plain field", () => {
    const csv = toCsv<Row>([{ name: "Rent", amount: "1" }], [{ header: "Name", value: (r) => r.name }]);
    expect(csv).toBe("Name\r\nRent\r\n");
  });
});
