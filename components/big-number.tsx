import type { ReactNode } from "react";
import Decimal from "decimal.js";
import { cn } from "@/lib/utils";
import { Money } from "@/components/money";

export type BigNumberProps = {
  value: Decimal.Value;
  decimals?: number;
  caption?: ReactNode;
  className?: string;
};

export function BigNumber({ value, decimals = 0, caption, className }: BigNumberProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <span className="text-hero text-number">
        <Money value={value} decimals={decimals} />
      </span>
      {caption ? (
        <span className="text-muted-foreground mt-3 text-sm">{caption}</span>
      ) : null}
    </div>
  );
}
