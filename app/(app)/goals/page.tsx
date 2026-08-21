import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { getGoalsOverviewForUser } from "@/lib/services/goal-service";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { formatLongDate } from "@/lib/format-date";
import { sum } from "@/lib/money";
import type { GoalStatus } from "@/lib/engines/goals";
import { AddEntityDialog } from "@/components/forms/add-entity-dialog";
import { GoalForm } from "@/components/forms/goal-form";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteGoalAction } from "./actions";

const STATUS_LABEL: Record<GoalStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
};

const STATUS_BADGE_VARIANT: Record<GoalStatus, "secondary" | "outline" | "destructive"> = {
  ON_TRACK: "secondary",
  AT_RISK: "outline",
  OFF_TRACK: "destructive",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

export default async function GoalsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const goals = await getGoalsOverviewForUser(userId, new Date());
  const todayIso = toIstDateInputValue(todayIst());
  const onTrackCount = goals.filter((g) => g.projection.status === "ON_TRACK").length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What you&apos;re building toward, and whether your current pace gets you there.
        </p>
      </div>

      {goals.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Goals" value={goals.length} />
          <StatCard label="On track" value={`${onTrackCount} / ${goals.length}`} />
          <StatCard label="Total target" value={<Money value={sum(goals.map((g) => g.targetAmount))} shorthand />} />
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Your goals</CardTitle>
          <AddEntityDialog triggerLabel="Add goal" title="Add goal">
            <GoalForm todayIso={todayIso} />
          </AddEntityDialog>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <EmptyState
              title="No goals yet"
              description="Add a goal — a child's education, a house down payment, retirement — to see whether your current pace gets you there."
            />
          ) : (
            <div className="flex flex-col gap-6">
              {goals.map((goal) => {
                const { projection } = goal;
                const progressPercent = projection.progressPercent.toFixed(1);
                return (
                  <div key={goal.id} className="flex flex-col gap-3 border-b pb-6 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{goal.name}</p>
                        <p className="text-muted-foreground text-xs">
                          Target {formatLongDate(goal.targetDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_BADGE_VARIANT[projection.status]}>
                          {STATUS_LABEL[projection.status]}
                        </Badge>
                        <form action={deleteGoalAction.bind(null, goal.id)}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            type="submit"
                            aria-label={`Delete ${goal.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </form>
                      </div>
                    </div>

                    <div
                      className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                      role="progressbar"
                      aria-valuenow={Number(progressPercent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${goal.name} progress`}
                    >
                      <div className="bg-foreground h-full rounded-full" style={{ width: `${progressPercent}%` }} />
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                      <Row label="Saved so far">
                        <Money value={goal.currentAmount} />
                      </Row>
                      <Row label="Target (inflation-adj.)">
                        <Money value={projection.inflationAdjustedTarget} />
                      </Row>
                      <Row label="Projected at target date">
                        <Money value={projection.projectedAmount} />
                      </Row>
                      <Row label="Contribution needed/mo">
                        <Money value={projection.requiredMonthlyContribution} />
                      </Row>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
