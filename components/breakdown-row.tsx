import type { ReactNode } from "react";
import Decimal from "decimal.js";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Money } from "@/components/money";
import { formatShortDate } from "@/lib/format-date";

export type BreakdownRowProps = {
  label: string;
  amount: Decimal.Value;
  date?: Date | null;
  /** Rendered inside an expandable detail when provided, making the row tappable to its arithmetic. */
  detail?: ReactNode;
  className?: string;
};

function RowLabel({ label, date }: { label: string; date?: Date | null }) {
  return (
    <span className="flex flex-col text-left">
      <span className="text-sm">{label}</span>
      {date ? (
        <span className="text-muted-foreground text-xs">{formatShortDate(date)}</span>
      ) : null}
    </span>
  );
}

export function BreakdownRow({ label, amount, date, detail, className }: BreakdownRowProps) {
  if (!detail) {
    return (
      <div className={cn("flex items-center justify-between gap-4 py-2.5", className)}>
        <RowLabel label={label} date={date} />
        <Money value={amount} colorize className="text-sm font-medium" />
      </div>
    );
  }

  return (
    <details className={cn("group py-2.5", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          <ChevronRight
            className="text-muted-foreground size-3.5 shrink-0 transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          <RowLabel label={label} date={date} />
        </span>
        <Money value={amount} colorize className="text-sm font-medium" />
      </summary>
      <div className="text-muted-foreground mt-2 pl-5 text-sm">{detail}</div>
    </details>
  );
}
