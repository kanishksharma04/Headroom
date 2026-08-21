"use client";

import { useActionState } from "react";
import { checkJobLossRunwayAction, type JobLossFormState } from "@/app/(app)/decide/actions";
import { formatLongDate } from "@/lib/format-date";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const initialState: JobLossFormState = {};

export function JobLossTool() {
  const [state, formAction, isPending] = useActionState(checkJobLossRunwayAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Checking…" : "Check my runway"}
        </Button>
      </form>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      {state.result ? (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Starting balance</span>
            <Money value={state.result.startingBalance} className="font-medium" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Monthly burn (no income)</span>
            <Money value={state.result.monthlyBurn} className="font-medium" />
          </div>

          <div className="bg-muted/40 rounded-lg border px-4 py-3">
            {state.result.runwayDays !== null && state.result.depletionDate ? (
              <p>
                At this pace, your balance is projected to run out around{" "}
                <span className="font-medium">{formatLongDate(new Date(state.result.depletionDate))}</span> —{" "}
                <span className="font-medium">{state.result.runwayDays} days</span> from today.
              </p>
            ) : (
              <p>Your balance is projected to stay positive through the horizon this check looks at.</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Emergency fund coverage</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{state.result.emergencyFundCoverageMonths} months</span>
              <Badge variant={state.result.meetsEmergencyFundTarget ? "secondary" : "destructive"}>
                {state.result.meetsEmergencyFundTarget ? "Meets target" : "Below target"}
              </Badge>
            </div>
          </div>

          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
            {state.result.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
