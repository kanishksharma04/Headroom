import { z } from "zod";
import { positiveMoneyStringSchema } from "@/lib/validation/money";
import { dateOnlyString } from "@/lib/validation/date";

export const prepayVsInvestScenarioSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  liabilityId: z.string().min(1),
  lumpSum: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  prepaymentMode: z.enum(["REDUCE_TENURE", "REDUCE_EMI"]),
});

export type PrepayVsInvestScenarioInput = z.infer<typeof prepayVsInvestScenarioSchema>;

export const affordabilityCheckSchema = z.object({
  purchaseAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  purchaseDate: dateOnlyString,
});

export type AffordabilityCheckInput = z.infer<typeof affordabilityCheckSchema>;
