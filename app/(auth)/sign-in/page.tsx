"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, type AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: AuthFormState = {};

function SignInForm({ onStartOver }: { onStartOver: () => void }) {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.needsTotp ? (
        <>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="password" value={password} />
          <p className="text-sm">
            Signing in as <span className="font-medium">{email}</span>.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Authentication code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              autoFocus
              required
            />
            <p className="text-muted-foreground text-xs">
              From your authenticator app, or one of your backup codes.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartOver}
            className="text-muted-foreground w-fit text-xs underline-offset-4 hover:underline"
          >
            Not you? Start over.
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </>
      )}

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="mt-2 w-full">
        {isPending ? "Signing in…" : state.needsTotp ? "Verify" : "Sign in"}
      </Button>
    </form>
  );
}

export default function SignInPage() {
  const [formKey, setFormKey] = useState(0);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Know what you can actually afford.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm key={formKey} onStartOver={() => setFormKey((k) => k + 1)} />
        <p className="text-muted-foreground mt-6 text-center text-sm">
          New to Headroom?{" "}
          <Link href="/sign-up" className="text-foreground font-medium underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
