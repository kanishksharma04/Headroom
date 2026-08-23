import { z } from "zod";
import { dateOnlyString } from "@/lib/validation/date";
import { nonNegativeMoneyStringSchema, positiveMoneyStringSchema } from "@/lib/validation/money";
import { optionalPercentStringSchema, percentStringSchema } from "@/lib/validation/percent";

export const LIABILITY_TYPES = [
  "HOME_LOAN",
  "PERSONAL_LOAN",
  "CAR_LOAN",
  "EDUCATION_LOAN",
  "CREDIT_CARD",
  "BNPL",
  "INFORMAL",
  "OTHER",
] as const;

export const LIABILITY_TYPE_LABELS: Record<(typeof LIABILITY_TYPES)[number], string> = {
  HOME_LOAN: "Home loan",
  PERSONAL_LOAN: "Personal loan",
  CAR_LOAN: "Car loan",
  EDUCATION_LOAN: "Education loan",
  CREDIT_CARD: "Credit card",
  BNPL: "Buy now, pay later",
  INFORMAL: "Informal / family loan",
  OTHER: "Other",
};

export const liabilityFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  type: z.enum(LIABILITY_TYPES),
  principalAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  annualInterestRatePercent: percentStringSchema({ max: 50 }),
  startDate: dateOnlyString,
  tenureMonths: z.coerce.number().int().min(1).max(600),
  emiAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  emiDayOfMonth: z.coerce.number().int().min(1).max(31),
  outstandingPrincipal: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
  outstandingAsOf: dateOnlyString,
  prepaymentPenaltyPercent: optionalPercentStringSchema({ max: 100 }),
  isTaxDeductible: z.boolean(),
  isSelfOccupied: z.boolean(),
  isJoint: z.boolean(),
});

export type LiabilityFormInput = z.infer<typeof liabilityFormSchema>;
