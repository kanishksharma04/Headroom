import Decimal from "decimal.js";
import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyShorthand } from "@/lib/format-money";

export type MoneyProps = {
  value: Decimal.Value;
  /** Use lakh/crore shorthand, e.g. "₹38.4L". Summary positions only. */
  shorthand?: boolean;
  /** Decimal places when not using shorthand. Default "auto": shows 2 only
   * when the value has a real fractional part, so paise are never silently
   * rounded away. */
  decimals?: number | "auto";
  /** Prefix positive, non-zero values with "+". */
  showSign?: boolean;
  /** Colour negative values with the risk colour. */
  colorize?: boolean;
  className?: string;
};

export function Money({
  value,
  shorthand = false,
  decimals = "auto",
  showSign = false,
  colorize = false,
  className,
}: MoneyProps) {
  const amount = value instanceof Decimal ? value : new Decimal(value);
  const formatted = shorthand
    ? formatMoneyShorthand(amount)
    : formatMoney(amount, { decimals, showSign });

  return (
    <span
      className={cn(
        "tabular-nums",
        colorize && amount.isNegative() && "text-destructive",
        className,
      )}
    >
      {formatted}
    </span>
  );
}
