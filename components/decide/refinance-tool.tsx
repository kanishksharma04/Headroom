"use client";

import { useActionState, useState } from "react";
import { checkRefinanceAction, type RefinanceFormState } from "@/app/(app)/decide/actions";
import type { LiabilityOption } from "@/components/decide/prepay-vs-invest-tool";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: RefinanceFormState = {};

export function RefinanceTool({ liabilities }: { liabilities: LiabilityOption[] }) {
  const [liabilityId, setLiabilityId] = useState(liabilities[0]?.id ?? "");
  const [state, formAction, isPending] = useActionState(checkRefinanceAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <input type="hidden" name="liabilityId" value={liabilityId} />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="refi-liability">Loan</Label>
          <Select value={liabilityId} onValueChange={(v) => setLiabilityId(v ?? "")}>
            <SelectTrigger id="refi-liability" className="w-full">
              <SelectValue>{(value: string) => liabilities.find((l) => l.id === value)?.name ?? "Select a loan"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {liabilities.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-rate">New rate (%)</Label>
          <Input id="new-rate" name="newAnnualRatePercent" inputMode="decimal" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-fee">Processing fee (%)</Label>
          <Input id="new-fee" name="newLoanProcessingFeePercent" inputMode="decimal" required />
        </div>
        <div className="sm:col-span-4">
          <Button type="submit" disabled={isPending || !liabilityId} className="w-full sm:w-auto">
            {isPending ? "Comparing…" : "Compare"}
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
            <span className="text-muted-foreground">EMI</span>
            <span>
              <Money value={state.result.currentEmi} /> → <Money value={state.result.newEmi} className="font-medium" />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Monthly saving</span>
            <Money value={state.result.emiDelta} showSign colorize className="font-medium" />
          </div>

          <div className="bg-muted/40 rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">Over the remaining tenure</p>
            <div className="mt-2 flex items-center justify-between">
              <span>Interest saved by switching</span>
              <Money value={state.result.interestSaved} showSign colorize />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Switching costs (penalty + processing fee)</span>
              <Money value={state.result.switchingCosts} colorize />
            </div>
            {state.result.lostDeductionValue !== "0.00" ? (
              <div className="mt-1 flex items-center justify-between">
                <span>Lost tax deduction value</span>
                <Money value={state.result.lostDeductionValue} colorize />
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between border-t pt-2 font-medium">
              <span>Net benefit</span>
              <Money value={state.result.netBenefit} showSign colorize />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Break-even</span>
            <span>
              {state.result.breakEvenMonths === null
                ? "Never — the new rate isn't actually lower"
                : `${state.result.breakEvenMonths} months`}
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
