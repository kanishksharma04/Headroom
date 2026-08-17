import Decimal from "decimal.js";

const LAKH = 1_00_000;
const CRORE = 1_00_00_000;

/**
 * Groups a string of digits (no sign, no decimal point) using the Indian
 * numbering system: the last three digits form one group, then the
 * remaining digits are grouped in pairs. e.g. "1234567" -> "12,34,567".
 */
export function groupIndianDigits(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }

  const lastThree = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];

  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) {
    groups.unshift(rest);
  }

  return [...groups, lastThree].join(",");
}

export type FormatMoneyOptions = {
  /**
   * Number of decimal places to display, or "auto" (the default): shows 2
   * decimal places when the value has a real fractional part (e.g. an EMI
   * of ₹34,966.51), and 0 when it's a whole rupee amount. Never silently
   * rounds away real paise — pass an explicit number to force a fixed width.
   */
  decimals?: number | "auto";
  /** Prefix positive, non-zero values with "+". Default false. */
  showSign?: boolean;
};

/**
 * Formats a monetary value with Indian digit grouping and a rupee sign,
 * e.g. "₹1,20,000" or "-₹42,300.50". Never routes the value through a
 * JavaScript number — grouping operates on the decimal string directly.
 */
export function formatMoney(
  value: Decimal.Value,
  { decimals = "auto", showSign = false }: FormatMoneyOptions = {},
): string {
  const amount = value instanceof Decimal ? value : new Decimal(value);
  const resolvedDecimals =
    decimals === "auto" ? (amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).mod(1).isZero() ? 0 : 2) : decimals;
  const fixed = amount.toFixed(resolvedDecimals);
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [integerPart, fractionalPart] = unsigned.split(".");

  const grouped = groupIndianDigits(integerPart);
  const sign = negative ? "-" : showSign && !amount.isZero() ? "+" : "";

  return `${sign}₹${grouped}${fractionalPart ? `.${fractionalPart}` : ""}`;
}

/**
 * Formats a monetary value using lakh/crore shorthand for summary
 * positions, e.g. "₹38.4L" or "₹1.2Cr". Falls back to the full grouped
 * form below one lakh, where shorthand would be misleading.
 */
export function formatMoneyShorthand(value: Decimal.Value): string {
  const amount = value instanceof Decimal ? value : new Decimal(value);
  const abs = amount.abs();
  const negative = amount.isNegative();

  let divisor: Decimal | null = null;
  let suffix = "";
  if (abs.gte(CRORE)) {
    divisor = new Decimal(CRORE);
    suffix = "Cr";
  } else if (abs.gte(LAKH)) {
    divisor = new Decimal(LAKH);
    suffix = "L";
  }

  if (!divisor) {
    return formatMoney(amount);
  }

  const scaled = abs.div(divisor).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
  return `${negative ? "-" : ""}₹${scaled.toFixed(1)}${suffix}`;
}
