import { z } from "zod";
import { nonNegativeMoneyStringSchema, positiveMoneyStringSchema } from "@/lib/validation/money";
import { dateOnlyString } from "@/lib/validation/date";
import { percentStringSchema } from "@/lib/validation/percent";

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

export const incomeChangeCheckSchema = z.object({
  newMonthlySalary: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
});

export type IncomeChangeCheckInput = z.infer<typeof incomeChangeCheckSchema>;

export const refinanceCheckSchema = z.object({
  liabilityId: z.string().min(1),
  newAnnualRatePercent: percentStringSchema({ max: 30 }),
  newLoanProcessingFeePercent: percentStringSchema({ max: 10 }),
});

export type RefinanceCheckInput = z.infer<typeof refinanceCheckSchema>;

export const insuranceAdequacyCheckSchema = z.object({
  existingCoverage: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
});

export type InsuranceAdequacyCheckInput = z.infer<typeof insuranceAdequacyCheckSchema>;

export const retirementCorpusCheckSchema = z
  .object({
    currentAge: z.coerce.number().int().min(16).max(100),
    retirementAge: z.coerce.number().int().min(16).max(100),
    monthlyRetirementContribution: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
    desiredMonthlyExpenseToday: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  })
  .refine((data) => data.retirementAge > data.currentAge, {
    message: "Retirement age must be after your current age.",
    path: ["retirementAge"],
  });

export type RetirementCorpusCheckInput = z.infer<typeof retirementCorpusCheckSchema>;
