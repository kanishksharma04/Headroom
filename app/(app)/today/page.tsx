import { redirect } from "next/navigation";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { auth } from "@/lib/auth";
import { getTodayOverviewForUser } from "@/lib/services/headroom-service";
import { formatLongDate, formatShortDate } from "@/lib/format-date";
import { Money } from "@/components/money";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function lineDetail(line: {
  kind: "BALANCE" | "INFLOW" | "OUTFLOW" | "VARIABLE_ESTIMATE";
  date: Date | null;
}): string | null {
  switch (line.kind) {
    case "BALANCE":
      return "Current balance, as of today.";
    case "INFLOW":
      return `Expected on ${formatLongDate(line.date!)}.`;
    case "OUTFLOW":
      return `Due on ${formatLongDate(line.date!)}.`;
    case "VARIABLE_ESTIMATE":
      return "Your typical day-to-day spending, pro-rated for this window.";
    default:
      return null;
  }
}

export default async function TodayPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const overview = await getTodayOverviewForUser(userId, new Date());
  const hasAnyData = overview.headroom.lines.some((line) => line.kind === "BALANCE");

  if (!hasAnyData) {
    return (
      <EmptyState
        title="Add an account to see your headroom"
        description="Once you add a bank or cash account, this screen will show exactly what you can safely spend — after everything you've already committed to."
        action={
          <Button render={<Link href="/worth" />} nativeButton={false}>
            Add an account
          </Button>
        }
      />
    );
  }

  const { headroom, netWorth, upcomingCommitments, attentionItems } = overview;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-10">
      <details className="group flex flex-col items-center text-center">
        <summary className="flex cursor-pointer list-none flex-col items-center [&::-webkit-details-marker]:hidden">
          <span className="text-hero text-number">
            <Money value={headroom.amount} colorize />
          </span>
          <span className="text-muted-foreground mt-3 flex items-center gap-1 text-sm">
            Yours to spend before {formatShortDate(headroom.window.to)}
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>

        <div className="mt-8 w-full divide-y text-left">
          {headroom.lines.map((line, index) => (
            <div key={`${line.sourceId ?? line.label}-${index}`} className="py-2.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">{line.label}</span>
                <Money value={line.amount} showSign colorize className="text-sm font-medium" />
              </div>
              {lineDetail(line) ? (
                <p className="text-muted-foreground mt-0.5 text-xs">{lineDetail(line)}</p>
              ) : null}
            </div>
          ))}
        </div>

        {headroom.assumptions.length > 0 ? (
          <ul className="text-muted-foreground mt-4 w-full list-disc space-y-1 pl-5 text-left text-xs">
            {headroom.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        ) : null}
      </details>

      {upcomingCommitments.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm font-medium">Coming up</h2>
          <div className="divide-y">
            {upcomingCommitments.map((commitment) => (
              <div key={commitment.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm">{commitment.label}</p>
                  <p className="text-muted-foreground text-xs">{formatShortDate(commitment.date)}</p>
                </div>
                <Money value={commitment.amount} showSign colorize className="text-sm font-medium" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Net worth" value={<Money value={netWorth.netWorth} shorthand colorize />} />
      </section>

      {attentionItems.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm font-medium">Needs attention</h2>
          <div className="flex flex-col gap-2">
            {attentionItems.map((item, index) => (
              <div
                key={`${item.sourceId ?? item.kind}-${index}`}
                className="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-lg border px-3 py-2.5"
              >
                <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">{item.message}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
