import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Link2, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAheadOverviewForUser } from "@/lib/services/ahead-service";
import { listCommitmentsForUser } from "@/lib/services/commitment-service";
import { getVariableSpendBaselineForUser } from "@/lib/services/variable-spend-service";
import {
  COMMITMENT_CATEGORY_LABELS,
  COMMITMENT_FREQUENCY_LABELS,
} from "@/lib/validation/commitment";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { formatShortDate } from "@/lib/format-date";
import { compare } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ProjectionHorizonDays } from "@/lib/engines/ahead";
import { deleteCommitmentAction } from "./actions";
import { AddEntityDialog } from "@/components/forms/add-entity-dialog";
import { CommitmentForm } from "@/components/forms/commitment-form";
import { VariableSpendForm } from "@/components/forms/variable-spend-form";
import { RunningBalanceChart } from "@/components/ahead/running-balance-chart";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const HORIZONS: ProjectionHorizonDays[] = [30, 60, 90];

function parseHorizon(value: string | undefined): ProjectionHorizonDays {
  const parsed = Number(value);
  return HORIZONS.includes(parsed as ProjectionHorizonDays) ? (parsed as ProjectionHorizonDays) : 90;
}

export default async function AheadPage({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const { horizon } = await searchParams;
  const horizonDays = parseHorizon(horizon);
  const now = new Date();

  const [{ projection, weeks, recurringSummary, dormantCommitments }, commitments, variableSpend] =
    await Promise.all([
      getAheadOverviewForUser(userId, now, horizonDays),
      listCommitmentsForUser(userId),
      getVariableSpendBaselineForUser(userId),
    ]);

  const todayIso = toIstDateInputValue(todayIst());

  const balancePoints = [
    { date: projection.from, balance: projection.startBalance },
    ...projection.points.map((point) => ({ date: point.date, balance: point.runningBalance })),
    { date: projection.to, balance: projection.endBalance },
  ];
  const lowestBalancePoint = balancePoints.reduce((lowest, point) =>
    compare(point.balance, lowest.balance) < 0 ? point : lowest,
  );
  const chartData = balancePoints.map((point) => ({
    date: point.date.getTime(),
    balance: point.balance.toNumber(),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ahead</h1>
        <p className="text-muted-foreground mt-1 text-sm">What&apos;s coming.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Recurring, per month"
          value={<Money value={recurringSummary.monthlyOutflowTotal} />}
        />
        <StatCard
          label="Recurring, per year"
          value={<Money value={recurringSummary.annualOutflowTotal} shorthand />}
        />
      </div>

      {dormantCommitments.length > 0 ? (
        <div className="flex flex-col gap-2">
          {dormantCommitments.map((commitment) => (
            <div
              key={commitment.id}
              className="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-lg border px-3 py-2.5"
            >
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                {commitment.name} hasn&apos;t been updated in a while — still happening?
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-tight">Timeline</h2>
          <div className="flex gap-1">
            {HORIZONS.map((d) => (
              <Button
                key={d}
                render={<Link href={`/ahead?horizon=${d}`} />}
                nativeButton={false}
                variant={d === horizonDays ? "default" : "outline"}
                size="sm"
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>

        {projection.points.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            description={`No commitments fall within the next ${horizonDays} days.`}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <RunningBalanceChart
                data={chartData}
                lowestPoint={{
                  date: lowestBalancePoint.date.getTime(),
                  balance: lowestBalancePoint.balance.toNumber(),
                }}
                goesNegative={projection.goesNegative}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                Lowest point:{" "}
                <Money value={lowestBalancePoint.balance} colorize className="font-medium" /> on{" "}
                {formatShortDate(lowestBalancePoint.date)}
              </p>
            </div>

            {weeks.map((week) => (
              <div key={week.weekStart.toISOString()}>
                <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Week of {formatShortDate(week.weekStart)}
                </h3>
                <div className="mt-2 divide-y">
                  {week.points.map((point, index) => {
                    const isNegative = point.runningBalance.isNegative();
                    return (
                      <div
                        key={`${point.sourceId}-${index}`}
                        className={cn(
                          "flex items-center justify-between gap-4 py-2.5 px-2 -mx-2 rounded-md",
                          isNegative && "bg-destructive/5",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {point.direction === "INFLOW" ? (
                            <ArrowDownLeft className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <ArrowUpRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                          )}
                          <div>
                            <p className="text-sm">{point.label}</p>
                            <p className="text-muted-foreground text-xs">{formatShortDate(point.date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Money value={point.amount} showSign colorize className="block text-sm font-medium" />
                          <Money
                            value={point.runningBalance}
                            colorize
                            className={cn(
                              "block text-xs",
                              isNegative ? "text-destructive font-medium" : "text-muted-foreground",
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Variable spend</CardTitle>
        </CardHeader>
        <CardContent>
          <VariableSpendForm currentAmount={variableSpend?.monthlyAmount.toString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Commitments</CardTitle>
          <AddEntityDialog triggerLabel="Add commitment" title="Add commitment">
            <CommitmentForm todayIso={todayIso} />
          </AddEntityDialog>
        </CardHeader>
        <CardContent>
          {commitments.length === 0 ? (
            <EmptyState
              title="No commitments yet"
              description="Add rent, SIPs, insurance premiums and subscriptions so the Headroom Number can net them out."
            />
          ) : (
            <ul className="divide-y">
              {commitments.map((commitment) => (
                <li key={commitment.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {commitment.name}
                      {commitment.linkedLiabilityId ? (
                        <Link2
                          className="text-muted-foreground size-3.5"
                          aria-label="Derived from a loan"
                        />
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {COMMITMENT_CATEGORY_LABELS[commitment.category]} ·{" "}
                      {COMMITMENT_FREQUENCY_LABELS[commitment.frequency]}
                      {!commitment.isActive ? " · Inactive" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money
                      value={commitment.amount}
                      showSign={commitment.direction === "INFLOW"}
                      className="text-sm font-medium"
                    />
                    {commitment.linkedLiabilityId ? (
                      <span className="text-muted-foreground w-9 text-center text-xs">—</span>
                    ) : (
                      <form action={deleteCommitmentAction.bind(null, commitment.id)}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="submit"
                          aria-label={`Delete ${commitment.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
