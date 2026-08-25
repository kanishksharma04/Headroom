"use client";

import { useActionState } from "react";
import { checkRetirementCorpusAction, type RetirementCorpusFormState } from "@/app/(app)/decide/actions";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RetirementCorpusFormState = {};

export function RetirementCorpusTool() {
  const [state, formAction, isPending] = useActionState(checkRetirementCorpusAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-age">Your age today</Label>
          <Input id="current-age" name="currentAge" inputMode="numeric" placeholder="30" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="retirement-age">Target retirement age</Label>
          <Input id="retirement-age" name="retirementAge" inputMode="numeric" placeholder="60" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="monthly-retirement-contribution">Monthly retirement saving (₹)</Label>
          <Input id="monthly-retirement-contribution" name="monthlyRetirementContribution" inputMode="decimal" placeholder="20000" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desired-monthly-expense">Desired monthly spend in retirement, today&apos;s ₹</Label>
          <Input id="desired-monthly-expense" name="desiredMonthlyExpenseToday" inputMode="decimal" placeholder="50000" required />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? "Projecting…" : "Project my retirement"}
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
          <div className="bg-muted/40 rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">
              {state.result.yearsToRetirement} years to retirement · {state.result.yearsInRetirement} years in
              retirement
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span>Starting from today&apos;s net worth</span>
              <Money value={state.result.currentNetWorth} colorize />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Projected corpus at retirement</span>
              <Money value={state.result.projectedCorpusAtRetirement} />
            </div>
          </div>

          <div className="bg-muted/40 rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">What retirement would actually cost</p>
            <div className="mt-2 flex items-center justify-between">
              <span>Monthly expense, inflated to your first year of retirement</span>
              <Money value={state.result.inflationAdjustedMonthlyExpense} />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Corpus required at retirement</span>
              <Money value={state.result.requiredCorpusAtRetirement} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Corpus position (negative is a real shortfall)</span>
            <Money value={state.result.corpusPosition} showSign colorize className="font-medium" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Monthly contribution that would close any gap</span>
            <span>
              <Money value={state.result.requiredMonthlyContribution} /> vs.{" "}
              <Money value={state.result.monthlyRetirementContribution} className="text-muted-foreground" /> now
            </span>
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
