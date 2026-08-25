"use client";

import { useActionState } from "react";
import { checkInsuranceAdequacyAction, type InsuranceAdequacyFormState } from "@/app/(app)/decide/actions";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InsuranceAdequacyFormState = {};

export function InsuranceAdequacyTool() {
  const [state, formAction, isPending] = useActionState(checkInsuranceAdequacyAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="existing-coverage">Total life insurance you already hold (₹)</Label>
          <Input id="existing-coverage" name="existingCoverage" inputMode="decimal" placeholder="0" required />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Checking…" : "Check adequacy"}
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
            <p className="text-muted-foreground text-xs">What your family would need</p>
            <div className="mt-2 flex items-center justify-between">
              <span>Income replacement</span>
              <Money value={state.result.incomeReplacementValue} />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Outstanding debt</span>
              <Money value={state.result.debtCoverage} />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Unfinished goals</span>
              <Money value={state.result.goalCoverage} />
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 font-medium">
              <span>Required cover</span>
              <Money value={state.result.requiredCover} />
            </div>
          </div>

          <div className="bg-muted/40 rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">What you already have</p>
            <div className="mt-2 flex items-center justify-between">
              <span>Existing coverage</span>
              <Money value={state.result.existingCoverage} />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Accounts and other assets</span>
              <Money value={state.result.totalAssets} />
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 font-medium">
              <span>Available resources</span>
              <Money value={state.result.availableResources} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Net position (negative is a real shortfall)</span>
            <Money value={state.result.netPosition} showSign colorize className="font-medium" />
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
