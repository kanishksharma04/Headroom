import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, FileText, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { getWorthOverviewForUser } from "@/lib/services/worth-service";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validation/account";
import { ASSET_TYPE_LABELS } from "@/lib/validation/asset";
import { LIABILITY_TYPE_LABELS } from "@/lib/validation/liability";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { formatLongDate } from "@/lib/format-date";
import { describeNetWorthAttribution } from "@/lib/format-attribution";
import { NetWorthHistoryChart } from "@/components/worth/net-worth-history-chart";
import { sum } from "@/lib/money";
import type { Asset, Liability } from "@/lib/generated/prisma/client";
import { deleteAccountAction, deleteAssetAction, deleteLiabilityAction } from "./actions";
import { AddEntityDialog } from "@/components/forms/add-entity-dialog";
import { AccountForm } from "@/components/forms/account-form";
import { AssetForm } from "@/components/forms/asset-form";
import { LiabilityForm } from "@/components/forms/liability-form";
import { StatCard } from "@/components/stat-card";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function groupByType<T extends { type: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.type) ?? [];
    list.push(item);
    groups.set(item.type, list);
  }
  return groups;
}

export default async function WorthPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const { netWorth, ownershipSplit, accounts, assets, liabilities, history, attribution, yearOverYear, cagr } =
    await getWorthOverviewForUser(userId);
  const hasJointHoldings =
    !ownershipSplit.joint.totalAssets.isZero() || !ownershipSplit.joint.totalLiabilities.isZero();

  const todayIso = toIstDateInputValue(todayIst());
  const assetGroups = groupByType<Asset>(assets);
  const liabilityGroups = groupByType<Liability>(liabilities);
  const chartData = history.map((point) => ({
    date: point.date.getTime(),
    netWorth: point.netWorth.toNumber(),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Worth</h1>
        <p className="text-muted-foreground mt-1 text-sm">Where you stand, in full.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Net worth" value={<Money value={netWorth.netWorth} shorthand colorize />} />
        <StatCard label="Total assets" value={<Money value={netWorth.totalAssets} shorthand />} />
        <StatCard label="Total liabilities" value={<Money value={netWorth.totalLiabilities} shorthand />} />
      </div>

      {hasJointHoldings ? (
        <Card>
          <CardHeader>
            <CardTitle>By ownership</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {(
                [
                  ["Individual", ownershipSplit.individual],
                  ["Joint", ownershipSplit.joint],
                ] as const
              ).map(([label, result]) => (
                <div key={label}>
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {label}
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                    <Money value={result.netWorth} shorthand colorize />
                  </p>
                  <div className="text-muted-foreground mt-2 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between">
                      <span>Assets</span>
                      <Money value={result.totalAssets} shorthand />
                    </div>
                    <div className="flex justify-between">
                      <span>Liabilities</span>
                      <Money value={result.totalLiabilities} shorthand />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>History</CardTitle>
          <Button
            render={<a href="/api/export/net-worth-history" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <Download /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <p className="text-muted-foreground text-sm">
              Net worth history builds up as you keep your accounts, assets and liabilities current —
              check back after a few updates.
            </p>
          ) : (
            <NetWorthHistoryChart data={chartData} />
          )}

          <div className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                This month
              </p>
              <p className="text-muted-foreground mt-0.5">
                {attribution
                  ? describeNetWorthAttribution(attribution)
                  : "Come back in a few weeks to see what changed and why."}
              </p>
            </div>

            {yearOverYear ? (
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  This year
                </p>
                <p className="text-muted-foreground mt-0.5">{describeNetWorthAttribution(yearOverYear)}</p>
              </div>
            ) : null}

            {cagr ? (
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Compound annual growth
                </p>
                <p className="text-muted-foreground mt-0.5">
                  <span
                    className={cagr.cagrPercent.isNegative() ? "text-destructive font-medium" : "font-medium"}
                  >
                    {cagr.cagrPercent.toFixed(1)}%
                  </span>{" "}
                  a year since {formatLongDate(cagr.fromDate)} ({cagr.years.toFixed(1)} years of history).
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Accounts</CardTitle>
          <div className="flex items-center gap-2">
            <Button render={<Link href="/worth/sync" />} nativeButton={false} variant="outline" size="sm">
              Sync statement
            </Button>
            <AddEntityDialog triggerLabel="Add account" title="Add account">
              <AccountForm todayIso={todayIso} />
            </AddEntityDialog>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState
              title="No accounts yet"
              description="Add a savings or current account to start building your balance sheet."
            />
          ) : (
            <ul className="divide-y">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {ACCOUNT_TYPE_LABELS[account.type]}
                      {account.isJoint ? " · Joint" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money value={account.currentBalance} className="text-sm font-medium" />
                    <form action={deleteAccountAction.bind(null, account.id)}>
                      <Button variant="ghost" size="icon-sm" type="submit" aria-label={`Delete ${account.name}`}>
                        <Trash2 />
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Assets</CardTitle>
          <AddEntityDialog triggerLabel="Add asset" title="Add asset">
            <AssetForm todayIso={todayIso} />
          </AddEntityDialog>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <EmptyState
              title="No assets yet"
              description="Add your EPF, PPF, mutual funds, property or gold — anything AA can't see, this can."
            />
          ) : (
            <div className="flex flex-col gap-5">
              {Array.from(assetGroups.entries()).map(([type, items]) => {
                const subtotal = sum(items.map((item) => item.currentValue));
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {ASSET_TYPE_LABELS[type as keyof typeof ASSET_TYPE_LABELS]}
                      </h3>
                      <Money value={subtotal} className="text-muted-foreground text-xs font-medium" />
                    </div>
                    <ul className="divide-y">
                      {items.map((asset) => (
                        <li key={asset.id} className="flex items-center justify-between py-2.5">
                          <p className="text-sm font-medium">
                            {asset.name}
                            {asset.isJoint ? (
                              <span className="text-muted-foreground font-normal"> · Joint</span>
                            ) : null}
                          </p>
                          <div className="flex items-center gap-3">
                            <Money value={asset.currentValue} className="text-sm font-medium" />
                            <form action={deleteAssetAction.bind(null, asset.id)}>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                type="submit"
                                aria-label={`Delete ${asset.name}`}
                              >
                                <Trash2 />
                              </Button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Liabilities</CardTitle>
          <AddEntityDialog triggerLabel="Add liability" title="Add liability">
            <LiabilityForm todayIso={todayIso} />
          </AddEntityDialog>
        </CardHeader>
        <CardContent>
          {liabilities.length === 0 ? (
            <EmptyState
              title="No liabilities yet"
              description="Add a loan to see its amortisation schedule and run prepayment scenarios in Decide."
            />
          ) : (
            <div className="flex flex-col gap-5">
              {Array.from(liabilityGroups.entries()).map(([type, items]) => {
                const subtotal = sum(items.map((item) => item.outstandingPrincipal));
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {LIABILITY_TYPE_LABELS[type as keyof typeof LIABILITY_TYPE_LABELS]}
                      </h3>
                      <Money value={subtotal} className="text-muted-foreground text-xs font-medium" />
                    </div>
                    <ul className="divide-y">
                      {items.map((liability) => (
                        <li key={liability.id} className="flex items-center justify-between py-2.5">
                          <div>
                            <p className="text-sm font-medium">{liability.name}</p>
                            <p className="text-muted-foreground text-xs">
                              {liability.annualInterestRatePercent.toString()}%
                              {liability.isJoint ? " · Joint" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Money value={liability.outstandingPrincipal} className="text-sm font-medium" />
                            <Button
                              render={<Link href={`/worth/liabilities/${liability.id}/schedule`} />}
                              nativeButton={false}
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`View ${liability.name}'s amortisation schedule`}
                            >
                              <FileText />
                            </Button>
                            <form action={deleteLiabilityAction.bind(null, liability.id)}>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                type="submit"
                                aria-label={`Delete ${liability.name}`}
                              >
                                <Trash2 />
                              </Button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
