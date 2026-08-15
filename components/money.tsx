import Decimal from "decimal.js";
import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyShorthand } from "@/lib/format-money";

export type MoneyProps = {
  value: Decimal.Value;
  /** Use lakh/crore shorthand, e.g. "₹38.4L". Summary positions only. */
  shorthand?: boolean;
  /** Number of decimal places when not using shorthand. Default 0. */
  decimals?: number;
  /** Prefix positive, non-zero values with "+". */
  showSign?: boolean;
  /** Colour negative values with the risk colour. */
  colorize?: boolean;
  className?: string;
};

export function Money({
  value,
  shorthand = false,
  decimals = 0,
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
