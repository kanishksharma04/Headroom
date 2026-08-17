import { z } from "zod";
import { istDate } from "@/lib/dates";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A plain `YYYY-MM-DD` date string, as produced by an `<input type="date">`,
 * parsed as IST midnight on that calendar day — never the host runtime's
 * local timezone.
 */
export const dateOnlyString = z
  .string()
  .trim()
  .regex(DATE_ONLY_PATTERN, "Enter a valid date.")
  .transform((value) => {
    const [year, month, day] = value.split("-").map(Number);
    return istDate(year, month - 1, day);
  });
