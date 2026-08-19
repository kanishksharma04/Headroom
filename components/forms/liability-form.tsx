"use client";

import { useActionState } from "react";
import { createLiabilityAction, updateLiabilityAction, type FormState } from "@/app/(app)/worth/actions";
import { LIABILITY_TYPES, LIABILITY_TYPE_LABELS } from "@/lib/validation/liability";
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

export type ExistingLiability = {
  id: string;
  name: string;
  type: (typeof LIABILITY_TYPES)[number];
  principalAmount: string;
  annualInterestRatePercent: string;
  startDate: string;
  tenureMonths: number;
  emiAmount: string;
  emiDayOfMonth: number;
  outstandingPrincipal: string;
  outstandingAsOf: string;
  prepaymentPenaltyPercent: string | null;
  isTaxDeductible: boolean;
  isSelfOccupied: boolean;
};

export function LiabilityForm({
  todayIso,
  existing,
}: {
  todayIso: string;
  existing?: ExistingLiability;
}) {
  const action = existing ? updateLiabilityAction.bind(null, existing.id) : createLiabilityAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="liability-name">Name</Label>
        <Input
          id="liability-name"
          name="name"
          placeholder="Home Loan"
          defaultValue={existing?.name}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="liability-type">Type</Label>
        <Select name="type" defaultValue={existing?.type ?? "HOME_LOAN"}>
          <SelectTrigger id="liability-type" className="w-full">
            <SelectValue>{(value: (typeof LIABILITY_TYPES)[number]) => LIABILITY_TYPE_LABELS[value]}</SelectValue>
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
          <Label htmlFor="liability-principal">Sanctioned principal (₹)</Label>
          <Input
            id="liability-principal"
            name="principalAmount"
            inputMode="decimal"
            placeholder="4000000"
            defaultValue={existing?.principalAmount}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="liability-rate">Annual interest rate (%)</Label>
          <Input
            id="liability-rate"
            name="annualInterestRatePercent"
            inputMode="decimal"
            placeholder="8.6"
            defaultValue={existing?.annualInterestRatePercent}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="liability-start-date">Start date</Label>
          <Input
            id="liability-start-date"
            name="startDate"
            type="date"
            defaultValue={existing?.startDate ?? todayIso}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="liability-tenure">Tenure (months)</Label>
          <Input
            id="liability-tenure"
            name="tenureMonths"
            type="number"
            min={1}
            max={600}
            placeholder="240"
            defaultValue={existing?.tenureMonths}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="liability-emi">EMI amount (₹)</Label>
          <Input
            id="liability-emi"
            name="emiAmount"
            inputMode="decimal"
            placeholder="34966.51"
            defaultValue={existing?.emiAmount}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="liability-emi-day">EMI day of month</Label>
          <Input
            id="liability-emi-day"
            name="emiDayOfMonth"
            type="number"
            min={1}
            max={31}
            defaultValue={existing?.emiDayOfMonth ?? 5}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="liability-outstanding">Outstanding principal (₹)</Label>
          <Input
            id="liability-outstanding"
            name="outstandingPrincipal"
            inputMode="decimal"
            placeholder="3840000"
            defaultValue={existing?.outstandingPrincipal}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="liability-outstanding-as-of">Outstanding as of</Label>
          <Input
            id="liability-outstanding-as-of"
            name="outstandingAsOf"
            type="date"
            defaultValue={existing?.outstandingAsOf ?? todayIso}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="liability-penalty">Prepayment penalty % (optional)</Label>
        <Input
          id="liability-penalty"
          name="prepaymentPenaltyPercent"
          inputMode="decimal"
          placeholder="2"
          defaultValue={existing?.prepaymentPenaltyPercent ?? undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isTaxDeductible" defaultChecked={existing?.isTaxDeductible} />
          Interest is tax-deductible (Section 24(b))
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isSelfOccupied" defaultChecked={existing?.isSelfOccupied ?? true} />
          Self-occupied property
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : existing ? "Save changes" : "Add liability"}
      </Button>
    </form>
  );
}
