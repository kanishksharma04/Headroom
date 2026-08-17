import { z } from "zod";
import { positiveMoneyStringSchema } from "@/lib/validation/money";

export const variableSpendFormSchema = z.object({
  monthlyAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
});

export type VariableSpendFormInput = z.infer<typeof variableSpendFormSchema>;
