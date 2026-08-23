import { toMoney, type Money } from "@/lib/money";
import { istDate } from "@/lib/dates";

export type StatementTransaction = {
  date: Date;
  description: string;
  /** At most one of debit/credit is set — a transaction is either money out or money in. */
  debit: Money | null;
  credit: Money | null;
  balance: Money | null;
};

export type ParseStatementResult =
  | { ok: true; transactions: StatementTransaction[] }
  | { ok: false; error: string };

const MAX_ROWS = 5000;

const HEADER_ALIASES = {
  date: ["date", "transaction date", "txn date", "value date"],
  description: ["description", "narration", "particulars", "details", "remarks"],
  debit: ["debit", "withdrawal", "debit amount", "withdrawal amt", "withdrawal amt."],
  credit: ["credit", "deposit", "credit amount", "deposit amt", "deposit amt."],
  balance: ["balance", "closing balance", "running balance", "balance amt"],
} as const;

/** Splits one CSV line into fields, honouring double-quoted fields (with "" as an escaped quote). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function findColumn(headers: string[], key: keyof typeof HEADER_ALIASES): number {
  const aliases: readonly string[] = HEADER_ALIASES[key];
  return headers.findIndex((h) => aliases.includes(h));
}

// DD/MM/YYYY or DD-MM-YYYY (the Indian convention this app assumes throughout) and ISO YYYY-MM-DD.
const DATE_PATTERNS: { regex: RegExp; toParts: (m: RegExpMatchArray) => [number, number, number] }[] = [
  { regex: /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/, toParts: (m) => [Number(m[3]), Number(m[2]), Number(m[1])] },
  { regex: /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/, toParts: (m) => [Number(m[1]), Number(m[2]), Number(m[3])] },
];

/** Parses a statement date cell — DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD — as an IST calendar day. */
export function parseStatementDate(raw: string): Date | null {
  const trimmed = raw.trim();
  for (const { regex, toParts } of DATE_PATTERNS) {
    const match = trimmed.match(regex);
    if (!match) continue;
    const [year, month, day] = toParts(match);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    return istDate(year, month - 1, day);
  }
  return null;
}

/** Parses a statement amount cell — strips ₹, commas, and surrounding whitespace. Empty/blank cells are not amounts, not zero. */
export function parseStatementAmount(raw: string): Money | null {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  return toMoney(cleaned);
}

/**
 * Parses a bank statement CSV into transactions. Expects a header row with
 * a Date column, a Description/Narration column, and at least one of
 * Debit/Credit — the common shape of an Indian bank's exported statement.
 * This is deliberately not a universal bank-format auto-detector: dates
 * must be DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD, and unrecognised columns
 * are ignored rather than guessed at.
 */
export function parseStatementCsv(csvText: string): ParseStatementResult {
  const lines = csvText.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: "The file doesn't have any transaction rows." };
  }
  if (lines.length - 1 > MAX_ROWS) {
    return { ok: false, error: `That file has more than ${MAX_ROWS} rows — trim it to a shorter date range and try again.` };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateCol = findColumn(headers, "date");
  const descriptionCol = findColumn(headers, "description");
  const debitCol = findColumn(headers, "debit");
  const creditCol = findColumn(headers, "credit");
  const balanceCol = findColumn(headers, "balance");

  if (dateCol === -1 || descriptionCol === -1 || (debitCol === -1 && creditCol === -1)) {
    return {
      ok: false,
      error:
        "Couldn't find the expected columns. The file needs a Date column, a Description (or Narration) column, and at least one of Debit/Credit.",
    };
  }

  const transactions: StatementTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    if (fields.every((f) => f === "")) {
      continue;
    }

    const date = parseStatementDate(fields[dateCol] ?? "");
    if (!date) {
      return {
        ok: false,
        error: `Row ${i + 1}: couldn't read the date "${fields[dateCol] ?? ""}" — use DD/MM/YYYY or YYYY-MM-DD.`,
      };
    }

    transactions.push({
      date,
      description: fields[descriptionCol] ?? "",
      debit: debitCol !== -1 ? parseStatementAmount(fields[debitCol] ?? "") : null,
      credit: creditCol !== -1 ? parseStatementAmount(fields[creditCol] ?? "") : null,
      balance: balanceCol !== -1 ? parseStatementAmount(fields[balanceCol] ?? "") : null,
    });
  }

  return { ok: true, transactions };
}
