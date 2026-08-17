import { z } from "zod";
import { dateOnlyString } from "@/lib/validation/date";
import { nonNegativeMoneyStringSchema } from "@/lib/validation/money";
import { optionalPercentStringSchema } from "@/lib/validation/percent";

export const ASSET_TYPES = [
  "EQUITY",
  "MUTUAL_FUND",
  "ETF",
  "BOND",
  "FD",
  "RD",
  "EPF",
  "PPF",
  "NPS",
  "GOLD_PHYSICAL",
  "GOLD_DIGITAL",
  "SGB",
  "REAL_ESTATE",
  "VEHICLE",
  "CRYPTO",
  "OTHER",
] as const;

export const ASSET_TYPE_LABELS: Record<(typeof ASSET_TYPES)[number], string> = {
  EQUITY: "Stocks",
  MUTUAL_FUND: "Mutual fund",
  ETF: "ETF",
  BOND: "Bond",
  FD: "Fixed deposit",
  RD: "Recurring deposit",
  EPF: "EPF",
  PPF: "PPF",
  NPS: "NPS",
  GOLD_PHYSICAL: "Gold (physical)",
  GOLD_DIGITAL: "Gold (digital)",
  SGB: "Sovereign Gold Bond",
  REAL_ESTATE: "Real estate",
  VEHICLE: "Vehicle",
  CRYPTO: "Crypto",
  OTHER: "Other",
};

export const assetFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100),
  type: z.enum(ASSET_TYPES),
  investedAmount: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
  currentValue: nonNegativeMoneyStringSchema({ maxDecimalPlaces: 2 }),
  valuationAsOf: dateOnlyString,
  expectedAnnualReturnPercent: optionalPercentStringSchema({ max: 100 }),
  isJoint: z.boolean(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type AssetFormInput = z.infer<typeof assetFormSchema>;
