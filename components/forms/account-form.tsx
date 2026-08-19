"use client";

import { useActionState } from "react";
import { createAccountAction, updateAccountAction, type FormState } from "@/app/(app)/worth/actions";
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

export type ExistingAccount = {
  id: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  currentBalance: string;
  isJoint: boolean;
  balanceAsOf: string;
};

export function AccountForm({
  todayIso,
  existing,
}: {
  todayIso: string;
  existing?: ExistingAccount;
}) {
  const action = existing ? updateAccountAction.bind(null, existing.id) : createAccountAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-name">Name</Label>
        <Input
          id="account-name"
          name="name"
          placeholder="HDFC Savings"
          defaultValue={existing?.name}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-type">Type</Label>
        <Select name="type" defaultValue={existing?.type ?? "SAVINGS"}>
          <SelectTrigger id="account-type" className="w-full">
            <SelectValue>{(value: (typeof ACCOUNT_TYPES)[number]) => ACCOUNT_TYPE_LABELS[value]}</SelectValue>
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
        <Input
          id="account-balance"
          name="currentBalance"
          inputMode="decimal"
          placeholder="150000"
          defaultValue={existing?.currentBalance}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-balance-as-of">Balance as of</Label>
        <Input
          id="account-balance-as-of"
          name="balanceAsOf"
          type="date"
          defaultValue={existing?.balanceAsOf ?? todayIso}
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isJoint" defaultChecked={existing?.isJoint} />
        Joint account
      </label>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : existing ? "Save changes" : "Add account"}
      </Button>
    </form>
  );
}
