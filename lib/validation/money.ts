import { z } from "zod";

const DECIMAL_STRING_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * A money value serialised as a plain decimal string — no scientific
 * notation, no currency symbol, no thousands separators. Matches what
 * `serializeMoney` produces and what the database column accepts.
 */
export function moneyStringSchema(options?: { maxDecimalPlaces?: number }) {
  const maxDecimalPlaces = options?.maxDecimalPlaces ?? 4;

  return z
    .string()
    .trim()
    .min(1, "Enter an amount.")
    .regex(DECIMAL_STRING_PATTERN, "Enter a valid amount, e.g. 1200.50.")
    .refine((value) => {
      const [, fraction = ""] = value.split(".");
      return fraction.length <= maxDecimalPlaces;
    }, `Enter an amount with at most ${maxDecimalPlaces} decimal places.`);
}

/** The default money string schema: up to 4 decimal places. */
export const moneyString = moneyStringSchema();

/** A money string that must not be negative, e.g. a balance or a principal. */
export function nonNegativeMoneyStringSchema(options?: { maxDecimalPlaces?: number }) {
  return moneyStringSchema(options).refine(
    (value) => !value.startsWith("-"),
    "Enter an amount of zero or more.",
  );
}

/** A money string that must be strictly greater than zero. */
export function positiveMoneyStringSchema(options?: { maxDecimalPlaces?: number }) {
  return moneyStringSchema(options).refine(
    (value) => !value.startsWith("-") && !/^0(\.0+)?$/.test(value),
    "Enter an amount greater than zero.",
  );
}

/** Same as {@link nonNegativeMoneyStringSchema}, but treats an empty string as "not provided". */
export function optionalNonNegativeMoneyStringSchema(options?: { maxDecimalPlaces?: number }) {
  return z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    nonNegativeMoneyStringSchema(options).optional(),
  );
}
