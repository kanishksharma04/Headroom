import { z } from "zod";
import { dateOnlyString } from "@/lib/validation/date";
import { nonNegativeMoneyStringSchema, positiveMoneyStringSchema } from "@/lib/validation/money";
import { ACCOUNT_TYPES } from "@/lib/validation/account";
import { COMMITMENT_CATEGORIES, COMMITMENT_DIRECTIONS, COMMITMENT_FREQUENCIES } from "@/lib/validation/commitment";

export const importedAccountSchema = z.object({
  accountName: z.string().trim().min(1, "Enter a name for your account.").max(100),
  accountType: z.enum(ACCOUNT_TYPES),
  accountBalance: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
  accountBalanceAsOf: dateOnlyString,
});

export const importedCommitmentRowSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  direction: z.enum(COMMITMENT_DIRECTIONS),
  category: z.enum(COMMITMENT_CATEGORIES),
  amount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
  frequency: z.enum(COMMITMENT_FREQUENCIES),
  anchorDate: dateOnlyString,
  dayOfMonth: z.coerce.number().int().min(1).max(31),
});

export const importedVariableSpendSchema = z.object({
  variableSpendAmount: positiveMoneyStringSchema({ maxDecimalPlaces: 2 }),
});

export type ImportedAccountInput = z.infer<typeof importedAccountSchema>;
export type ImportedCommitmentRowInput = z.infer<typeof importedCommitmentRowSchema>;
export type ImportedVariableSpendInput = z.infer<typeof importedVariableSpendSchema>;
