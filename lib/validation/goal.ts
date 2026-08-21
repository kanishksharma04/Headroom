import { z } from "zod";
import { dateOnlyString } from "@/lib/validation/date";
import { nonNegativeMoneyStringSchema, positiveMoneyStringSchema } from "@/lib/validation/money";
import { percentStringSchema } from "@/lib/validation/percent";

export const goalFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  targetAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  currentAmount: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
  targetDate: dateOnlyString,
  monthlyContribution: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
  expectedAnnualReturnPercent: percentStringSchema({ max: 50 }),
  inflationPercent: percentStringSchema({ max: 50 }),
});

export type GoalFormInput = z.infer<typeof goalFormSchema>;
