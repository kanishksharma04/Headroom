"use client";

import { useActionState } from "react";
import { createAssetAction, type FormState } from "@/app/(app)/worth/actions";
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

export function AssetForm({ todayIso }: { todayIso: string }) {
  const [state, formAction, isPending] = useActionState(createAssetAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-name">Name</Label>
        <Input id="asset-name" name="name" placeholder="EPF" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-type">Type</Label>
        <Select name="type" defaultValue="MUTUAL_FUND">
          <SelectTrigger id="asset-type" className="w-full">
            <SelectValue />
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
          <Input id="asset-invested" name="investedAmount" inputMode="decimal" placeholder="600000" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-current-value">Current value (₹)</Label>
          <Input id="asset-current-value" name="currentValue" inputMode="decimal" placeholder="620000" required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-valuation-as-of">Valued as of</Label>
        <Input
          id="asset-valuation-as-of"
          name="valuationAsOf"
          type="date"
          defaultValue={todayIso}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-return">Expected annual return % (optional)</Label>
        <Input id="asset-return" name="expectedAnnualReturnPercent" inputMode="decimal" placeholder="12" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-notes">Notes (optional)</Label>
        <Textarea id="asset-notes" name="notes" rows={2} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isJoint" />
        Joint holding
      </label>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add asset"}
      </Button>
    </form>
  );
}
