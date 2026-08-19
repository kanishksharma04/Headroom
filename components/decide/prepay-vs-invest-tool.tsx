"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Decimal from "decimal.js";
import {
  deriveRemainingScheduleParams,
  prepayVsInvest,
  projectedInvestmentValue,
} from "@/lib/engines/decisions";
import type { PrepaymentMode, TaxProfile } from "@/lib/engines/amortisation";
import { saveScenarioAction, type FormState } from "@/app/(app)/decide/actions";
import { formatLongDate } from "@/lib/format-date";
import { formatMoney, formatMoneyShorthand } from "@/lib/format-money";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type LiabilityOption = {
  id: string;
  name: string;
  outstandingPrincipal: string;
  annualInterestRatePercent: string;
  emiAmount: string;
  emiDayOfMonth: number;
  startDate: string;
  tenureMonths: number;
  isSelfOccupied: boolean;
  prepaymentPenaltyPercent: string | null;
};

const initialSaveState: FormState = {};

export function PrepayVsInvestTool({
  liabilities,
  taxProfile,
  defaultLiabilityId,
  defaultLumpSum,
  defaultMode,
}: {
  liabilities: LiabilityOption[];
  taxProfile: TaxProfile;
  defaultLiabilityId?: string;
  defaultLumpSum?: string;
  defaultMode?: PrepaymentMode;
}) {
  const [liabilityId, setLiabilityId] = useState(defaultLiabilityId ?? liabilities[0]?.id ?? "");
  const [lumpSum, setLumpSum] = useState(defaultLumpSum ?? "200000");
  const [mode, setMode] = useState<PrepaymentMode>(defaultMode ?? "REDUCE_TENURE");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveState, saveFormAction, isSaving] = useActionState(saveScenarioAction, initialSaveState);

  const liability = liabilities.find((l) => l.id === liabilityId);

  const { result, chartData, error } = useMemo(() => {
    if (!liability) {
      return { result: null, chartData: [], error: "Add a loan on Worth to model this." };
    }
    let lumpSumDecimal: Decimal;
    try {
      lumpSumDecimal = new Decimal(lumpSum || "0");
    } catch {
      return { result: null, chartData: [], error: "Enter a valid amount." };
    }
    if (lumpSumDecimal.lessThanOrEqualTo(0)) {
      return { result: null, chartData: [], error: "Enter an amount greater than zero." };
    }

    try {
      const { remainingTenureMonths, firstDueDate } = deriveRemainingScheduleParams(
        {
          emiAmount: liability.emiAmount,
          emiDayOfMonth: liability.emiDayOfMonth,
          startDate: new Date(liability.startDate),
          tenureMonths: liability.tenureMonths,
        },
        new Date(),
      );

      const computed = prepayVsInvest({
        liability: {
          outstandingPrincipal: liability.outstandingPrincipal,
          annualRatePercent: liability.annualInterestRatePercent,
          remainingTenureMonths,
          firstDueDate,
          prepaymentPenaltyPercent: liability.prepaymentPenaltyPercent ?? undefined,
          isSelfOccupied: liability.isSelfOccupied,
        },
        lumpSum: lumpSumDecimal,
        prepaymentMode: mode,
        taxProfile,
      });

      const pessimisticRate = computed.investScenarios.find((s) => s.label === "PESSIMISTIC")!
        .annualReturnPercent;
      const baseRate = computed.investScenarios.find((s) => s.label === "BASE")!.annualReturnPercent;
      const optimisticRate = computed.investScenarios.find((s) => s.label === "OPTIMISTIC")!
        .annualReturnPercent;

      const sampleCount = Math.max(2, Math.min(remainingTenureMonths, 20));
      const step = Math.max(1, Math.round(remainingTenureMonths / sampleCount));
      const series: { month: number; pessimistic: number; base: number; optimistic: number; guaranteed: number }[] =
        [];
      for (let month = 0; month <= remainingTenureMonths; month += step) {
        series.push({
          month,
          pessimistic: projectedInvestmentValue(lumpSumDecimal, pessimisticRate, month).toNumber(),
          base: projectedInvestmentValue(lumpSumDecimal, baseRate, month).toNumber(),
          optimistic: projectedInvestmentValue(lumpSumDecimal, optimisticRate, month).toNumber(),
          guaranteed: projectedInvestmentValue(lumpSumDecimal, computed.hurdleRatePercent, month).toNumber(),
        });
      }
      if (series[series.length - 1]?.month !== remainingTenureMonths) {
        series.push({
          month: remainingTenureMonths,
          pessimistic: projectedInvestmentValue(lumpSumDecimal, pessimisticRate, remainingTenureMonths).toNumber(),
          base: projectedInvestmentValue(lumpSumDecimal, baseRate, remainingTenureMonths).toNumber(),
          optimistic: projectedInvestmentValue(lumpSumDecimal, optimisticRate, remainingTenureMonths).toNumber(),
          guaranteed: projectedInvestmentValue(lumpSumDecimal, computed.hurdleRatePercent, remainingTenureMonths).toNumber(),
        });
      }

      return { result: computed, chartData: series, error: null };
    } catch (e) {
      return { result: null, chartData: [], error: e instanceof Error ? e.message : "Could not compute this scenario." };
    }
  }, [liability, lumpSum, mode, taxProfile]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pvi-liability">Loan</Label>
          <Select value={liabilityId} onValueChange={(v) => setLiabilityId(v ?? "")}>
            <SelectTrigger id="pvi-liability" className="w-full">
              <SelectValue>
                {(value: string) => liabilities.find((l) => l.id === value)?.name ?? "Select a loan"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {liabilities.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pvi-lump-sum">Lump sum (₹)</Label>
          <Input
            id="pvi-lump-sum"
            inputMode="decimal"
            value={lumpSum}
            onChange={(e) => setLumpSum(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pvi-mode">Prepayment mode</Label>
          <Select value={mode} onValueChange={(v) => v && setMode(v as PrepaymentMode)}>
            <SelectTrigger id="pvi-mode" className="w-full">
              <SelectValue>
                {(value: PrepaymentMode) =>
                  value === "REDUCE_EMI" ? "Reduce EMI" : "Reduce tenure"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REDUCE_TENURE">Reduce tenure</SelectItem>
              <SelectItem value="REDUCE_EMI">Reduce EMI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-muted-foreground text-sm">{error}</p>
      ) : result ? (
        <>
          <div className="bg-muted/40 rounded-lg border px-4 py-3 text-sm">
            <p>
              What we can say factually: prepaying earns a guaranteed{" "}
              <span className="font-medium">{result.hurdleRatePercent.toFixed(2)}%</span>{" "}
              after-tax-adjusted return. Investing must beat that after tax and after risk to win.
            </p>
            <p className="mt-2">
              What we won&apos;t do: tell you which to choose. Here is the maths, both ways, with your
              actual numbers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Prepay</CardTitle>
                <Badge variant="secondary">Guaranteed</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <Row label="Interest saved">
                  <Money value={result.prepay.interestSaved} colorize />
                </Row>
                <Row label="Months saved">{result.prepay.monthsSaved}</Row>
                <Row label="New payoff date">{formatLongDate(result.prepay.newPayoffDate)}</Row>
                {result.prepay.penaltyCost.greaterThan(0) ? (
                  <Row label="Prepayment penalty">
                    <Money value={result.prepay.penaltyCost} colorize />
                  </Row>
                ) : null}
                <Row label="Lost tax deduction value">
                  <Money value={result.prepay.lostDeductionValue} colorize />
                </Row>
                <Row label="Net benefit" emphasize>
                  <Money value={result.prepay.netBenefit} colorize />
                </Row>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Invest</CardTitle>
                <Badge variant="secondary">Not guaranteed</Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {result.investScenarios.map((scenario) => (
                  <div key={scenario.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      At {scenario.annualReturnPercent.toString()}%
                    </span>
                    <Money value={scenario.postTaxValue} />
                  </div>
                ))}
                <p className="text-muted-foreground mt-1 text-xs">
                  Post-tax, after 12.5% capital gains on the gain portion.
                </p>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 1 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(m: number) => `${Math.round(m / 12)}y`}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatMoneyShorthand(v)}
                    width={64}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number" ? formatMoney(value, { decimals: 0 }) : String(value)
                    }
                    labelFormatter={(label) => `Month ${label}`}
                  />
                  <Legend />
                  {/* Neutral grayscale for the three (non-guaranteed) investment
                      scenarios — red/green are reserved elsewhere for risk and are
                      deliberately not used here, so "optimistic" never reads as a
                      warning. Only the guaranteed line gets the brand accent. */}
                  <Line type="monotone" dataKey="guaranteed" name="Guaranteed" stroke="var(--number)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pessimistic" name="Pessimistic" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="base" name="Base" stroke="var(--foreground)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="optimistic" name="Optimistic" stroke="var(--chart-4)" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div>
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                Save this scenario
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save scenario</DialogTitle>
                </DialogHeader>
                <form action={saveFormAction} className="flex flex-col gap-4">
                  <input type="hidden" name="liabilityId" value={liabilityId} />
                  <input type="hidden" name="lumpSum" value={lumpSum} />
                  <input type="hidden" name="prepaymentMode" value={mode} />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="scenario-name">Name</Label>
                    <Input id="scenario-name" name="name" placeholder="Prepay 2L this Diwali" required />
                  </div>
                  {saveState.error ? (
                    <p role="alert" className="text-destructive text-sm">
                      {saveState.error}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Row({
  label,
  children,
  emphasize,
}: {
  label: string;
  children: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={emphasize ? "font-medium" : undefined}>{children}</span>
    </div>
  );
}
