import { sum, type Money } from "@/lib/money";
import { addMonthsClamped, getIstParts, resolveIstDateForDayOfMonth } from "@/lib/dates";
import { formatShortDate } from "@/lib/format-date";
import type { HeadroomResult } from "@/lib/engines/headroom";

export type AttentionItemKind = "PROJECTED_SHORTFALL" | "OVERDUE_EMI";

export type AttentionItem = {
  kind: AttentionItemKind;
  message: string;
  amount: Money | null;
  date: Date | null;
  sourceId: string | null;
};

/**
 * Walks a Headroom result's dated lines in order, tracking a running
 * balance, to find the worst point the balance is projected to reach
 * within the window. Balances and the variable-spend estimate (both
 * undated) are treated as already reserved from day one — a deliberately
 * conservative assumption, since the variable estimate has no specific
 * date of its own to spread across the window.
 */
export function detectProjectedShortfall(result: HeadroomResult): AttentionItem | null {
  const undated = result.lines.filter((line) => !line.date);
  const dated = [...result.lines.filter((line) => line.date)].sort(
    (a, b) => a.date!.getTime() - b.date!.getTime(),
  );

  let running = sum(undated.map((line) => line.amount));
  let worst: { amount: Money; date: Date } | null = null;

  for (const line of dated) {
    running = running.plus(line.amount);
    if (running.isNegative() && (!worst || running.lessThan(worst.amount))) {
      worst = { amount: running, date: line.date! };
    }
  }

  if (!worst) {
    return null;
  }

  return {
    kind: "PROJECTED_SHORTFALL",
    message: `Your balance is projected to go negative around ${formatShortDate(worst.date)}.`,
    amount: worst.amount,
    date: worst.date,
    sourceId: null,
  };
}

export type LiabilityForOverdueCheck = {
  id: string;
  name: string;
  outstandingAsOf: Date;
  emiDayOfMonth: number;
};

/**
 * Flags a loan whose outstanding balance hasn't been updated since before
 * its most recent EMI was due — the only "was this actually paid" signal
 * V0 can honestly offer without bank sync or a mark-as-paid action.
 */
export function detectOverdueEmis(
  liabilities: LiabilityForOverdueCheck[],
  now: Date,
): AttentionItem[] {
  const { year, month } = getIstParts(now);

  return liabilities.flatMap((liability) => {
    const dueThisMonth = resolveIstDateForDayOfMonth(year, month, liability.emiDayOfMonth);
    const mostRecentDue =
      dueThisMonth.getTime() <= now.getTime() ? dueThisMonth : addMonthsClamped(dueThisMonth, -1);

    if (liability.outstandingAsOf.getTime() >= mostRecentDue.getTime()) {
      return [];
    }

    return [
      {
        kind: "OVERDUE_EMI" as const,
        message: `${liability.name}'s balance hasn't been updated since before its ${formatShortDate(mostRecentDue)} EMI — confirm it went through.`,
        amount: null,
        date: mostRecentDue,
        sourceId: liability.id,
      },
    ];
  });
}

/** Combines every detector and caps the result at three items, worst first. */
export function detectAttentionItems(
  headroom: HeadroomResult,
  liabilities: LiabilityForOverdueCheck[],
  now: Date,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  const shortfall = detectProjectedShortfall(headroom);
  if (shortfall) {
    items.push(shortfall);
  }
  items.push(...detectOverdueEmis(liabilities, now));

  return items.slice(0, 3);
}
