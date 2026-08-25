import { z } from "zod";
import { dateOnlyString } from "@/lib/validation/date";
import { nonNegativeMoneyStringSchema, optionalNonNegativeMoneyStringSchema } from "@/lib/validation/money";
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

const AMFI_SCHEME_CODE_PATTERN = /^\d+$/;

export const assetFormSchema = z
  .object({
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
    amfiSchemeCode: z.preprocess(
      (value) => (value === "" || value === undefined || value === null ? undefined : value),
      z.string().trim().regex(AMFI_SCHEME_CODE_PATTERN, "Enter a numeric AMFI scheme code.").max(20).optional(),
    ),
    unitsHeld: optionalNonNegativeMoneyStringSchema({ maxDecimalPlaces: 4 }),
  })
  .superRefine((data, ctx) => {
    const hasSchemeCode = data.amfiSchemeCode !== undefined;
    const hasUnits = data.unitsHeld !== undefined;
    if (hasSchemeCode !== hasUnits) {
      ctx.addIssue({
        code: "custom",
        path: ["unitsHeld"],
        message: "Enter both an AMFI scheme code and units held to enable price sync, or leave both blank.",
      });
    }
    if (hasSchemeCode && data.type !== "MUTUAL_FUND") {
      ctx.addIssue({
        code: "custom",
        path: ["amfiSchemeCode"],
        message: "Price sync is only available for mutual funds.",
      });
    }
  });

export type AssetFormInput = z.infer<typeof assetFormSchema>;
