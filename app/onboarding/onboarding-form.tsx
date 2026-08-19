"use client";

import { useActionState, useState } from "react";
import { completeOnboardingAction, type OnboardingFormState } from "@/app/onboarding/actions";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/validation/account";
import { LIABILITY_TYPES, LIABILITY_TYPE_LABELS } from "@/lib/validation/liability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: OnboardingFormState = {};

export function OnboardingForm({ todayIso }: { todayIso: string }) {
  const [state, formAction, isPending] = useActionState(completeOnboardingAction, initialState);
  const [hasLoan, setHasLoan] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Your salary</CardTitle>
          <CardDescription>What comes in, and when.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="salaryAmount">Monthly salary (₹)</Label>
            <Input id="salaryAmount" name="salaryAmount" inputMode="decimal" placeholder="85000" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="salaryDayOfMonth">Day of month credited</Label>
            <Input
              id="salaryDayOfMonth"
              name="salaryDayOfMonth"
              type="number"
              min={1}
              max={31}
              placeholder="1"
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where your money sits</CardTitle>
          <CardDescription>The bank or cash balance you can spend from today.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountName">Account name</Label>
            <Input id="accountName" name="accountName" placeholder="HDFC Savings" required />
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
                placeholder="120000"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Any loans?</CardTitle>
          <CardDescription>EMIs are one of the biggest claims on next month&apos;s cash.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              name="hasLoan"
              checked={hasLoan}
              onCheckedChange={(checked) => setHasLoan(checked === true)}
            />
            I have a loan to track
          </label>

          {hasLoan ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="loanName">Loan name</Label>
                <Input id="loanName" name="loanName" placeholder="Home Loan" required={hasLoan} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="loanType">Type</Label>
                <Select name="loanType" defaultValue="HOME_LOAN">
                  <SelectTrigger id="loanType" className="w-full">
                    <SelectValue>
                      {(value: (typeof LIABILITY_TYPES)[number]) => LIABILITY_TYPE_LABELS[value]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LIABILITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {LIABILITY_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loanPrincipal">Sanctioned principal (₹)</Label>
                  <Input
                    id="loanPrincipal"
                    name="loanPrincipal"
                    inputMode="decimal"
                    placeholder="4000000"
                    required={hasLoan}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loanRate">Annual interest rate (%)</Label>
                  <Input id="loanRate" name="loanRate" inputMode="decimal" placeholder="8.6" required={hasLoan} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loanStartDate">Start date</Label>
                  <Input
                    id="loanStartDate"
                    name="loanStartDate"
                    type="date"
                    defaultValue={todayIso}
                    required={hasLoan}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loanTenureMonths">Tenure (months)</Label>
                  <Input
                    id="loanTenureMonths"
                    name="loanTenureMonths"
                    type="number"
                    min={1}
                    max={600}
                    placeholder="240"
                    required={hasLoan}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loanEmiAmount">EMI amount (₹)</Label>
                  <Input
                    id="loanEmiAmount"
                    name="loanEmiAmount"
                    inputMode="decimal"
                    placeholder="34966.51"
                    required={hasLoan}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loanEmiDayOfMonth">EMI day of month</Label>
                  <Input
                    id="loanEmiDayOfMonth"
                    name="loanEmiDayOfMonth"
                    type="number"
                    min={1}
                    max={31}
                    placeholder="5"
                    required={hasLoan}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loanOutstanding">Outstanding principal (₹)</Label>
                  <Input
                    id="loanOutstanding"
                    name="loanOutstanding"
                    inputMode="decimal"
                    placeholder="3840000"
                    required={hasLoan}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="loanOutstandingAsOf">Outstanding as of</Label>
                  <Input
                    id="loanOutstandingAsOf"
                    name="loanOutstandingAsOf"
                    type="date"
                    defaultValue={todayIso}
                    required={hasLoan}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Everyday spending</CardTitle>
          <CardDescription>
            A typical month&apos;s groceries, eating out, travel — the stuff that isn&apos;t a fixed
            commitment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="variableSpendAmount">Monthly estimate (₹)</Label>
            <Input
              id="variableSpendAmount"
              name="variableSpendAmount"
              inputMode="decimal"
              placeholder="25000"
              required
            />
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? "Setting up…" : "See my headroom"}
      </Button>
    </form>
  );
}
