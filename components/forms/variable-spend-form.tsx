"use client";

import { useActionState } from "react";
import { setVariableSpendAction, type FormState } from "@/app/(app)/ahead/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = {};

export function VariableSpendForm({ currentAmount }: { currentAmount?: string }) {
  const [state, formAction, isPending] = useActionState(setVariableSpendAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="variable-spend-amount">Typical variable spend per month (₹)</Label>
        <Input
          id="variable-spend-amount"
          name="monthlyAmount"
          inputMode="decimal"
          placeholder="15000"
          defaultValue={currentAmount}
          required
        />
        {state.error ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
