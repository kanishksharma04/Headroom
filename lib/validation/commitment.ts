import { z } from "zod";
import { dateOnlyString } from "@/lib/validation/date";
import { moneyStringSchema } from "@/lib/validation/money";

export const COMMITMENT_DIRECTIONS = ["INFLOW", "OUTFLOW"] as const;

export const COMMITMENT_CATEGORIES = [
  "SALARY",
  "RENT",
  "EMI",
  "SIP",
  "INSURANCE",
  "UTILITY",
  "SUBSCRIPTION",
  "CREDIT_CARD_BILL",
  "TAX",
  "OTHER",
] as const;

export const COMMITMENT_CATEGORY_LABELS: Record<(typeof COMMITMENT_CATEGORIES)[number], string> = {
  SALARY: "Salary",
  RENT: "Rent",
  EMI: "EMI",
  SIP: "SIP",
  INSURANCE: "Insurance",
  UTILITY: "Utility",
  SUBSCRIPTION: "Subscription",
  CREDIT_CARD_BILL: "Credit card bill",
  TAX: "Tax",
  OTHER: "Other",
};

export const COMMITMENT_FREQUENCIES = [
  "ONE_TIME",
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
] as const;

export const COMMITMENT_FREQUENCY_LABELS: Record<(typeof COMMITMENT_FREQUENCIES)[number], string> = {
  ONE_TIME: "One time",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  ANNUAL: "Annual",
};

export const commitmentFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(100),
    direction: z.enum(COMMITMENT_DIRECTIONS),
    category: z.enum(COMMITMENT_CATEGORIES),
    amount: moneyStringSchema({ maxDecimalPlaces: 2 }),
    isVariable: z.boolean(),
    frequency: z.enum(COMMITMENT_FREQUENCIES),
    anchorDate: dateOnlyString,
    dayOfMonth: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? undefined : value),
      z.coerce.number().int().min(1).max(31).optional(),
    ),
    endDate: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? undefined : value),
      dateOnlyString.optional(),
    ),
  })
  .refine((data) => !data.endDate || data.endDate.getTime() >= data.anchorDate.getTime(), {
    message: "End date must be on or after the anchor date.",
    path: ["endDate"],
  });

export type CommitmentFormInput = z.infer<typeof commitmentFormSchema>;
