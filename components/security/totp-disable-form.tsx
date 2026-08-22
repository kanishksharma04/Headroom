"use client";

import { useActionState } from "react";
import { disableTotpAction, type DisableTotpState } from "@/app/(app)/security/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: DisableTotpState = {};

export function TotpDisableForm() {
  const [state, formAction, isPending] = useActionState(disableTotpAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="disable-totp-password">Confirm your password to turn it off</Label>
        <Input
          id="disable-totp-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="max-w-64"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? "Turning off…" : "Turn off two-factor authentication"}
        </Button>
      </div>
    </form>
  );
}
