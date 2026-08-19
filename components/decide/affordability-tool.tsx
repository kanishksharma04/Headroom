"use client";

import { useActionState } from "react";
import { checkAffordabilityAction, type AffordabilityFormState } from "@/app/(app)/decide/actions";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { formatShortDate } from "@/lib/format-date";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AffordabilityFormState = {};

export function AffordabilityTool() {
  const [state, formAction, isPending] = useActionState(checkAffordabilityAction, initialState);
  const todayIso = toIstDateInputValue(todayIst());

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="purchase-amount">Purchase amount (₹)</Label>
          <Input id="purchase-amount" name="purchaseAmount" inputMode="decimal" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="purchase-date">Purchase date</Label>
          <Input id="purchase-date" name="purchaseDate" type="date" defaultValue={todayIso} required />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Checking…" : "Check affordability"}
          </Button>
        </div>
      </form>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      {state.result ? (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Resulting headroom</span>
            <Money value={state.result.resultingHeadroom} colorize className="font-medium" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Emergency fund coverage</span>
            <span>
              {state.result.emergencyFundMonthsBefore} → {state.result.emergencyFundMonthsAfter} months
            </span>
          </div>

          {state.result.commitmentsAtRisk.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1">Commitments at risk</p>
              <div className="divide-y">
                {state.result.commitmentsAtRisk.map((c, i) => (
                  <div key={`${c.id}-${i}`} className="flex items-center justify-between py-1.5">
                    <span>
                      {c.name} · {formatShortDate(new Date(c.date))}
                    </span>
                    <Money value={c.amount} colorize />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {state.result.goalImpacts.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1">Goal impact</p>
              <div className="divide-y">
                {state.result.goalImpacts.map((g) => (
                  <div key={g.goalId} className="flex items-center justify-between py-1.5">
                    <span>{g.goalName}</span>
                    <span>
                      {g.monthsDelayed > 0 ? `+${g.monthsDelayed} months` : "On track"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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
