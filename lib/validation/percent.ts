import { z } from "zod";

const PERCENT_PATTERN = /^\d+(\.\d+)?$/;

/** A non-negative percentage string, e.g. "8.6". */
export function percentStringSchema(options?: { max?: number }) {
  let schema = z.string().trim().regex(PERCENT_PATTERN, "Enter a valid percentage.");
  if (options?.max !== undefined) {
    const max = options.max;
    schema = schema.refine((value) => Number(value) <= max, `Enter a percentage of at most ${max}.`);
  }
  return schema;
}

/** Same as {@link percentStringSchema}, but treats an empty string as "not provided". */
export function optionalPercentStringSchema(options?: { max?: number }) {
  return z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    percentStringSchema(options).optional(),
  );
}
