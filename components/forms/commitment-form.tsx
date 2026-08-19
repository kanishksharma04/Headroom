"use client";

import { useActionState } from "react";
import { createCommitmentAction, type FormState } from "@/app/(app)/ahead/actions";
import {
  COMMITMENT_CATEGORIES,
  COMMITMENT_CATEGORY_LABELS,
  COMMITMENT_FREQUENCIES,
  COMMITMENT_FREQUENCY_LABELS,
} from "@/lib/validation/commitment";
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

export function CommitmentForm({ todayIso }: { todayIso: string }) {
  const [state, formAction, isPending] = useActionState(createCommitmentAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="commitment-name">Name</Label>
        <Input id="commitment-name" name="name" placeholder="Rent" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commitment-direction">Direction</Label>
          <Select name="direction" defaultValue="OUTFLOW">
            <SelectTrigger id="commitment-direction" className="w-full">
              <SelectValue>
                {(value: "OUTFLOW" | "INFLOW") => (value === "INFLOW" ? "Money in" : "Money out")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OUTFLOW">Money out</SelectItem>
              <SelectItem value="INFLOW">Money in</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commitment-category">Category</Label>
          <Select name="category" defaultValue="OTHER">
            <SelectTrigger id="commitment-category" className="w-full">
              <SelectValue>
                {(value: (typeof COMMITMENT_CATEGORIES)[number]) => COMMITMENT_CATEGORY_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMMITMENT_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {COMMITMENT_CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="commitment-amount">Amount (₹)</Label>
        <Input id="commitment-amount" name="amount" inputMode="decimal" placeholder="25000" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commitment-frequency">Frequency</Label>
          <Select name="frequency" defaultValue="MONTHLY">
            <SelectTrigger id="commitment-frequency" className="w-full">
              <SelectValue>
                {(value: (typeof COMMITMENT_FREQUENCIES)[number]) => COMMITMENT_FREQUENCY_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMMITMENT_FREQUENCIES.map((frequency) => (
                <SelectItem key={frequency} value={frequency}>
                  {COMMITMENT_FREQUENCY_LABELS[frequency]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commitment-anchor-date">First due</Label>
          <Input
            id="commitment-anchor-date"
            name="anchorDate"
            type="date"
            defaultValue={todayIso}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commitment-day-of-month">Day of month (optional)</Label>
          <Input id="commitment-day-of-month" name="dayOfMonth" type="number" min={1} max={31} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commitment-end-date">Ends on (optional)</Label>
          <Input id="commitment-end-date" name="endDate" type="date" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isVariable" />
        Amount varies each time
      </label>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add commitment"}
      </Button>
    </form>
  );
}
