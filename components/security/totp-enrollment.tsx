"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmTotpEnrollmentAction,
  startTotpEnrollmentAction,
  type ConfirmEnrollmentState,
  type EnrollmentState,
} from "@/app/(app)/security/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialConfirmState: ConfirmEnrollmentState = {};

export function TotpEnrollment() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [isStarting, startStarting] = useTransition();
  const [confirmState, confirmFormAction, isConfirming] = useActionState(
    confirmTotpEnrollmentAction,
    initialConfirmState,
  );

  function handleStart() {
    startStarting(async () => {
      setEnrollment(await startTotpEnrollmentAction());
    });
  }

  if (confirmState.backupCodes) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Two-factor authentication is on. Save these backup codes somewhere safe — each works once, and
          this is the only time they&apos;ll be shown. Use one to sign in if you lose access to your
          authenticator app.
        </p>
        <div className="bg-muted grid grid-cols-2 gap-2 rounded-lg border p-4 font-mono text-sm">
          {confirmState.backupCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
        <div>
          <Button type="button" onClick={() => router.refresh()}>
            Done — I&apos;ve saved these
          </Button>
        </div>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Add a second step to sign-in: a 6-digit code from an authenticator app (Google Authenticator,
          1Password, Authy, and similar all work), in addition to your password.
        </p>
        <div>
          <Button type="button" onClick={handleStart} disabled={isStarting}>
            {isStarting ? "Starting…" : "Set up two-factor authentication"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">Scan this with your authenticator app, or enter the code manually:</p>
      {enrollment.qrCodeDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element -- a locally-generated data: URI, not a remote image Next's optimizer can do anything useful with
        <img
          src={enrollment.qrCodeDataUri}
          alt="QR code for two-factor authentication setup"
          width={200}
          height={200}
          className="rounded-lg border"
        />
      ) : null}
      {enrollment.secret ? (
        <p className="bg-muted w-fit rounded-md border px-3 py-1.5 font-mono text-sm break-all">
          {enrollment.secret}
        </p>
      ) : null}

      <form action={confirmFormAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="totp-confirm-code">Code from your app</Label>
          <Input
            id="totp-confirm-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            required
            className="max-w-40"
          />
        </div>
        {confirmState.error ? (
          <p role="alert" className="text-destructive text-sm">
            {confirmState.error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={isConfirming}>
            {isConfirming ? "Verifying…" : "Verify and turn on"}
          </Button>
        </div>
      </form>
    </div>
  );
}
