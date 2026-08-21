"use client";

import { useActionState } from "react";
import { createGoalAction, updateGoalAction, type FormState } from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = {};

export type ExistingGoal = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  monthlyContribution: string;
  expectedAnnualReturnPercent: string;
  inflationPercent: string;
};

export function GoalForm({ todayIso, existing }: { todayIso: string; existing?: ExistingGoal }) {
  const action = existing ? updateGoalAction.bind(null, existing.id) : createGoalAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-name">Name</Label>
        <Input
          id="goal-name"
          name="name"
          placeholder="Child's Education Fund"
          defaultValue={existing?.name}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-target-amount">Target amount (₹)</Label>
          <Input
            id="goal-target-amount"
            name="targetAmount"
            inputMode="decimal"
            placeholder="2500000"
            defaultValue={existing?.targetAmount}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-target-date">Target date</Label>
          <Input
            id="goal-target-date"
            name="targetDate"
            type="date"
            defaultValue={existing?.targetDate ?? todayIso}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-current-amount">Saved so far (₹)</Label>
          <Input
            id="goal-current-amount"
            name="currentAmount"
            inputMode="decimal"
            placeholder="200000"
            defaultValue={existing?.currentAmount ?? "0"}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-monthly-contribution">Monthly contribution (₹)</Label>
          <Input
            id="goal-monthly-contribution"
            name="monthlyContribution"
            inputMode="decimal"
            placeholder="12000"
            defaultValue={existing?.monthlyContribution}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-return">Expected annual return (%)</Label>
          <Input
            id="goal-return"
            name="expectedAnnualReturnPercent"
            inputMode="decimal"
            placeholder="10"
            defaultValue={existing?.expectedAnnualReturnPercent}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-inflation">Inflation (%)</Label>
          <Input
            id="goal-inflation"
            name="inflationPercent"
            inputMode="decimal"
            placeholder="6"
            defaultValue={existing?.inflationPercent ?? "6"}
            required
          />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : existing ? "Save changes" : "Add goal"}
      </Button>
    </form>
  );
}
