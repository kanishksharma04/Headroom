export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string;
};

const NEEDS_QUOTING = /[",\r\n]/;

function escapeCsvField(field: string): string {
  return NEEDS_QUOTING.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

/**
 * Serialises rows to CSV text: a header line followed by one line per row,
 * CRLF-terminated (RFC 4180), with any field containing a comma, quote, or
 * newline quoted and its internal quotes doubled.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => escapeCsvField(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => escapeCsvField(c.value(row))).join(",")),
  ];
  return lines.join("\r\n") + "\r\n";
}
