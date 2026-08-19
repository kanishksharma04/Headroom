import { z } from "zod";
import { dateOnlyString } from "@/lib/validation/date";
import { nonNegativeMoneyStringSchema, positiveMoneyStringSchema } from "@/lib/validation/money";
import { percentStringSchema } from "@/lib/validation/percent";
import { ACCOUNT_TYPES } from "@/lib/validation/account";
import { LIABILITY_TYPES } from "@/lib/validation/liability";

export const onboardingSalarySchema = z.object({
  salaryAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  salaryDayOfMonth: z.coerce.number().int().min(1).max(31),
});

export const onboardingAccountSchema = z.object({
  accountName: z.string().trim().min(1, "Enter a name for your account.").max(100),
  accountType: z.enum(ACCOUNT_TYPES),
  accountBalance: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
});

export const onboardingLoanSchema = z.object({
  loanName: z.string().trim().min(1, "Enter a name for your loan.").max(100),
  loanType: z.enum(LIABILITY_TYPES),
  loanPrincipal: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  loanRate: percentStringSchema({ max: 50 }),
  loanStartDate: dateOnlyString,
  loanTenureMonths: z.coerce.number().int().min(1).max(600),
  loanEmiAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  loanEmiDayOfMonth: z.coerce.number().int().min(1).max(31),
  loanOutstanding: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
  loanOutstandingAsOf: dateOnlyString,
});

export const onboardingVariableSpendSchema = z.object({
  variableSpendAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
});

export type OnboardingSalaryInput = z.infer<typeof onboardingSalarySchema>;
export type OnboardingAccountInput = z.infer<typeof onboardingAccountSchema>;
export type OnboardingLoanInput = z.infer<typeof onboardingLoanSchema>;
export type OnboardingVariableSpendInput = z.infer<typeof onboardingVariableSpendSchema>;
