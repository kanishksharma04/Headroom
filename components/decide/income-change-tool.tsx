"use client";

import { useActionState } from "react";
import { checkIncomeChangeAction, type IncomeChangeFormState } from "@/app/(app)/decide/actions";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: IncomeChangeFormState = {};

export function IncomeChangeTool() {
  const [state, formAction, isPending] = useActionState(checkIncomeChangeAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="new-monthly-salary">New monthly salary (₹)</Label>
          <Input id="new-monthly-salary" name="newMonthlySalary" inputMode="decimal" required />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Modelling…" : "Model this"}
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
            <span className="text-muted-foreground">Current monthly salary</span>
            <Money value={state.result.currentMonthlySalary} className="font-medium" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">New monthly salary</span>
            <Money value={state.result.newMonthlySalary} className="font-medium" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Monthly change</span>
            <Money value={state.result.monthlySalaryDelta} showSign colorize className="font-medium" />
          </div>

          <div className="bg-muted/40 rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">90-day cash flow projection</p>
            <div className="mt-2 flex items-center justify-between">
              <span>At today&apos;s salary</span>
              <Money value={state.result.projectedEndBalanceBefore} colorize />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>At the new salary</span>
              <Money value={state.result.projectedEndBalanceAfter} colorize />
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 font-medium">
              <span>Difference</span>
              <Money value={state.result.projectedEndBalanceDelta} showSign colorize />
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
