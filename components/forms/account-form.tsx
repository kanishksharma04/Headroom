"use client";

import { useActionState } from "react";
import { createAccountAction, type FormState } from "@/app/(app)/worth/actions";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/validation/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: FormState = {};

export function AccountForm({ todayIso }: { todayIso: string }) {
  const [state, formAction, isPending] = useActionState(createAccountAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-name">Name</Label>
        <Input id="account-name" name="name" placeholder="HDFC Savings" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-type">Type</Label>
        <Select name="type" defaultValue="SAVINGS">
          <SelectTrigger id="account-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ACCOUNT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-balance">Current balance (₹)</Label>
        <Input id="account-balance" name="currentBalance" inputMode="decimal" placeholder="150000" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-balance-as-of">Balance as of</Label>
        <Input
          id="account-balance-as-of"
          name="balanceAsOf"
          type="date"
          defaultValue={todayIso}
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isJoint" />
        Joint account
      </label>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add account"}
      </Button>
    </form>
  );
}
