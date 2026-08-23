"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  confirmImportedOnboardingAction,
  parseStatementAction,
  type ConfirmImportState,
  type ParseStatementState,
} from "@/app/onboarding/import/actions";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/validation/account";
import { COMMITMENT_CATEGORY_LABELS, COMMITMENT_FREQUENCY_LABELS } from "@/lib/validation/commitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialParseState: ParseStatementState = {};
const initialConfirmState: ConfirmImportState = {};

export function StatementImportForm({ todayIso }: { todayIso: string }) {
  const [parseState, parseFormAction, isParsing] = useActionState(parseStatementAction, initialParseState);
  const [confirmState, confirmFormAction, isConfirming] = useActionState(
    confirmImportedOnboardingAction,
    initialConfirmState,
  );

  const hasResults = parseState.accountBalance !== undefined || (parseState.commitments?.length ?? 0) > 0;

  if (!hasResults) {
    return (
      <form action={parseFormAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Choose a CSV file</CardTitle>
            <CardDescription>
              Needs a Date, a Description (or Narration), and at least one of Debit/Credit — most
              Indian banks&apos; statement exports already look like this.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="statement-file">Statement CSV</Label>
              <Input id="statement-file" name="file" type="file" accept=".csv,text/csv" required />
            </div>
            <a
              href="/sample-statement.csv"
              download
              className="text-muted-foreground w-fit text-xs underline-offset-4 hover:underline"
            >
              Download a sample CSV to see the expected format
            </a>
          </CardContent>
        </Card>

        {parseState.error ? (
          <p role="alert" className="text-destructive text-sm">
            {parseState.error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            render={<Link href="/onboarding" />}
            nativeButton={false}
          >
            Enter manually instead
          </Button>
          <Button type="submit" disabled={isParsing} size="lg" className="flex-1">
            {isParsing ? "Reading…" : "Read file"}
          </Button>
        </div>
      </form>
    );
  }

  const commitments = parseState.commitments ?? [];

  return (
    <form action={confirmFormAction} className="flex flex-col gap-6">
      <input type="hidden" name="commitmentCount" value={commitments.length} />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {parseState.accountBalance
              ? "Balance read from the statement — check it against today's actual figure."
              : "No balance column was found — enter your current balance."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountName">Account name</Label>
            <Input
              id="accountName"
              name="accountName"
              defaultValue={parseState.suggestedAccountName}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accountType">Type</Label>
              <Select name="accountType" defaultValue="SAVINGS">
                <SelectTrigger id="accountType" className="w-full">
                  <SelectValue>
                    {(value: (typeof ACCOUNT_TYPES)[number]) => ACCOUNT_TYPE_LABELS[value]}
                  </SelectValue>
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
              <Label htmlFor="accountBalance">Current balance (₹)</Label>
              <Input
                id="accountBalance"
                name="accountBalance"
                inputMode="decimal"
                defaultValue={parseState.accountBalance}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountBalanceAsOf">Balance as of</Label>
            <Input
              id="accountBalanceAsOf"
              name="accountBalanceAsOf"
              type="date"
              defaultValue={parseState.accountBalanceAsOf ?? todayIso}
              required
            />
          </div>
        </CardContent>
      </Card>

      {commitments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recurring payments found</CardTitle>
            <CardDescription>
              Uncheck anything that isn&apos;t actually recurring, or rename/fix the amount — you can
              adjust the rest (category, frequency) from Records afterward.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {commitments.map((c, i) => (
              <div key={i} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0">
                <input type="hidden" name={`commitment-${i}-direction`} value={c.direction} />
                <input type="hidden" name={`commitment-${i}-category`} value={c.category} />
                <input type="hidden" name={`commitment-${i}-frequency`} value={c.frequency} />
                <input type="hidden" name={`commitment-${i}-anchorDate`} value={c.anchorDate} />
                <input type="hidden" name={`commitment-${i}-dayOfMonth`} value={c.dayOfMonth} />

                <div className="flex items-start gap-3">
                  <Checkbox
                    name={`commitment-${i}-included`}
                    defaultChecked
                    className="mt-2"
                    aria-label={`Include ${c.name}`}
                  />
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      name={`commitment-${i}-name`}
                      defaultValue={c.name}
                      className="sm:flex-1"
                      required
                    />
                    <Input
                      name={`commitment-${i}-amount`}
                      inputMode="decimal"
                      defaultValue={c.amount}
                      className="sm:w-32"
                      required
                    />
                  </div>
                </div>
                <div className="ml-7 flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="secondary">{COMMITMENT_CATEGORY_LABELS[c.category as keyof typeof COMMITMENT_CATEGORY_LABELS]}</Badge>
                  <Badge variant="outline">{c.direction === "INFLOW" ? "Money in" : "Money out"}</Badge>
                  <span className="text-muted-foreground">
                    {COMMITMENT_FREQUENCY_LABELS[c.frequency as keyof typeof COMMITMENT_FREQUENCY_LABELS]} · day{" "}
                    {c.dayOfMonth} · seen {c.occurrenceCount} times
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">
          No recurring payments were detected — you can add rent, EMIs, and subscriptions from Ahead
          afterward.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Everyday spending</CardTitle>
          <CardDescription>
            A typical month&apos;s groceries, eating out, travel — not derivable from a statement
            without categorising every small transaction, so this one&apos;s a manual estimate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="variableSpendAmount">Monthly estimate (₹)</Label>
            <Input id="variableSpendAmount" name="variableSpendAmount" inputMode="decimal" placeholder="25000" required />
          </div>
        </CardContent>
      </Card>

      {confirmState.error ? (
        <p role="alert" className="text-destructive text-sm">
          {confirmState.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => window.location.reload()}
        >
          Choose a different file
        </Button>
        <Button type="submit" disabled={isConfirming} size="lg" className="flex-1">
          {isConfirming ? "Setting up…" : "See my headroom"}
        </Button>
      </div>
    </form>
  );
}
