"use client";

import { useActionState } from "react";
import { sendHouseholdInviteAction, type FormState } from "@/app/(app)/household/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = {};

export function InviteForm() {
  const [state, formAction, isPending] = useActionState(sendHouseholdInviteAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invitee-email">Partner&apos;s email</Label>
        <Input
          id="invitee-email"
          name="inviteeEmail"
          type="email"
          placeholder="partner@example.com"
          required
          className="max-w-xs"
        />
        <p className="text-muted-foreground text-xs">
          They need an existing Headroom account under this email — ask them to sign up first if they
          don&apos;t have one yet.
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
