"use client";

import { useActionState } from "react";
import { createAssetAction, updateAssetAction, type FormState } from "@/app/(app)/worth/actions";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/validation/asset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: FormState = {};

export type ExistingAsset = {
  id: string;
  name: string;
  type: (typeof ASSET_TYPES)[number];
  investedAmount: string;
  currentValue: string;
  valuationAsOf: string;
  expectedAnnualReturnPercent: string | null;
  isJoint: boolean;
  notes: string | null;
  amfiSchemeCode: string | null;
  unitsHeld: string | null;
};

export function AssetForm({ todayIso, existing }: { todayIso: string; existing?: ExistingAsset }) {
  const action = existing ? updateAssetAction.bind(null, existing.id) : createAssetAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-name">Name</Label>
        <Input id="asset-name" name="name" placeholder="EPF" defaultValue={existing?.name} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-type">Type</Label>
        <Select name="type" defaultValue={existing?.type ?? "MUTUAL_FUND"}>
          <SelectTrigger id="asset-type" className="w-full">
            <SelectValue>{(value: (typeof ASSET_TYPES)[number]) => ASSET_TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ASSET_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ASSET_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-invested">Invested (₹)</Label>
          <Input
            id="asset-invested"
            name="investedAmount"
            inputMode="decimal"
            placeholder="600000"
            defaultValue={existing?.investedAmount}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-current-value">Current value (₹)</Label>
          <Input
            id="asset-current-value"
            name="currentValue"
            inputMode="decimal"
            placeholder="620000"
            defaultValue={existing?.currentValue}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-valuation-as-of">Valued as of</Label>
        <Input
          id="asset-valuation-as-of"
          name="valuationAsOf"
          type="date"
          defaultValue={existing?.valuationAsOf ?? todayIso}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-return">Expected annual return % (optional)</Label>
        <Input
          id="asset-return"
          name="expectedAnnualReturnPercent"
          inputMode="decimal"
          placeholder="12"
          defaultValue={existing?.expectedAnnualReturnPercent ?? undefined}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-notes">Notes (optional)</Label>
        <Textarea id="asset-notes" name="notes" rows={2} defaultValue={existing?.notes ?? undefined} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-amfi-code">AMFI scheme code (optional)</Label>
          <Input
            id="asset-amfi-code"
            name="amfiSchemeCode"
            inputMode="numeric"
            placeholder="119551"
            defaultValue={existing?.amfiSchemeCode ?? undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-units-held">Units held (optional)</Label>
          <Input
            id="asset-units-held"
            name="unitsHeld"
            inputMode="decimal"
            placeholder="1250.5"
            defaultValue={existing?.unitsHeld ?? undefined}
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        For mutual funds only — enter both to turn on daily NAV sync, which keeps current value and
        valued-as-of up to date automatically.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isJoint" defaultChecked={existing?.isJoint} />
        Joint holding
      </label>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : existing ? "Save changes" : "Add asset"}
      </Button>
    </form>
  );
}
