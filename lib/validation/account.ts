import { z } from "zod";
import { dateOnlyString } from "@/lib/validation/date";
import { moneyStringSchema } from "@/lib/validation/money";

export const ACCOUNT_TYPES = ["SAVINGS", "CURRENT", "CASH", "WALLET"] as const;

export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  SAVINGS: "Savings account",
  CURRENT: "Current account",
  CASH: "Cash",
  WALLET: "Wallet",
};

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  type: z.enum(ACCOUNT_TYPES),
  currentBalance: moneyStringSchema({ maxDecimalPlaces: 2 }),
  isJoint: z.boolean(),
  balanceAsOf: dateOnlyString,
});

export type AccountFormInput = z.infer<typeof accountFormSchema>;
