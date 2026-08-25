"use client";

import { useActionState, useState } from "react";
import {
  confirmResyncAction,
  parseResyncStatementAction,
  type ConfirmResyncState,
  type ParseResyncState,
} from "@/app/(app)/worth/sync/actions";
import { COMMITMENT_CATEGORY_LABELS, COMMITMENT_FREQUENCY_LABELS } from "@/lib/validation/commitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialParseState: ParseResyncState = {};
const initialConfirmState: ConfirmResyncState = {};

export function StatementResyncForm({
  accounts,
  todayIso,
}: {
  accounts: { id: string; name: string }[];
  todayIso: string;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [parseState, parseFormAction, isParsing] = useActionState(parseResyncStatementAction, initialParseState);
  const [confirmState, confirmFormAction, isConfirming] = useActionState(confirmResyncAction, initialConfirmState);

  const hasResults = parseState.accountBalance !== undefined || (parseState.commitments?.length ?? 0) > 0;

  if (!hasResults) {
    return (
      <form action={parseFormAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Choose a CSV file</CardTitle>
            <CardDescription>
              Needs a Date, a Description (or Narration), and at least one of Debit/Credit — the same
              format as onboarding&apos;s import.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resync-account">Which account is this?</Label>
              <input type="hidden" name="accountId" value={accountId} />
              <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "")}>
                <SelectTrigger id="resync-account" className="w-full">
                  <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.name ?? "Select an account"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resync-file">Statement CSV</Label>
              <Input id="resync-file" name="file" type="file" accept=".csv,text/csv" required />
            </div>
          </CardContent>
        </Card>

        {parseState.error ? (
          <p role="alert" className="text-destructive text-sm">
            {parseState.error}
          </p>
        ) : null}

        <Button type="submit" disabled={isParsing || !accountId} size="lg">
          {isParsing ? "Reading…" : "Read file"}
        </Button>
      </form>
    );
  }

  const commitments = parseState.commitments ?? [];
  const hasBalance = parseState.accountBalance !== undefined;

  return (
    <form action={confirmFormAction} className="flex flex-col gap-6">
      <input type="hidden" name="accountId" value={parseState.accountId} />
      <input type="hidden" name="commitmentCount" value={commitments.length} />

      {hasBalance ? (
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
            <CardDescription>Read from the statement — check it against today&apos;s actual figure.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Checkbox name="updateBalance" defaultChecked className="mt-2" aria-label="Update this account's balance" />
              <div className="flex flex-1 flex-col gap-4 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="accountBalance">New balance (₹)</Label>
                  <Input id="accountBalance" name="accountBalance" inputMode="decimal" defaultValue={parseState.accountBalance} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="accountBalanceAsOf">As of</Label>
                  <Input
                    id="accountBalanceAsOf"
                    name="accountBalanceAsOf"
                    type="date"
                    defaultValue={parseState.accountBalanceAsOf ?? todayIso}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {commitments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>New recurring payments found</CardTitle>
            <CardDescription>
              Anything already tracked on Records was left out. Uncheck anything that isn&apos;t
              actually recurring, or rename/fix the amount.
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
                    <Input name={`commitment-${i}-name`} defaultValue={c.name} className="sm:flex-1" required />
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
      ) : null}

      {confirmState.error ? (
        <p role="alert" className="text-destructive text-sm">
          {confirmState.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => window.location.reload()}>
          Choose a different file
        </Button>
        <Button type="submit" disabled={isConfirming} size="lg" className="flex-1">
          {isConfirming ? "Syncing…" : "Sync"}
        </Button>
      </div>
    </form>
  );
}
