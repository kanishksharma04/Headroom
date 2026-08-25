import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findUserById } from "@/lib/repositories/user-repository";
import { getWorthOverviewForUser } from "@/lib/services/worth-service";
import { getGoalsOverviewForUser } from "@/lib/services/goal-service";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validation/account";
import { ASSET_TYPE_LABELS } from "@/lib/validation/asset";
import { LIABILITY_TYPE_LABELS } from "@/lib/validation/liability";
import { todayIst } from "@/lib/dates";
import { formatLongDate } from "@/lib/format-date";
import { sum } from "@/lib/money";
import type { GoalStatus } from "@/lib/engines/goals";
import type { Asset, Liability } from "@/lib/generated/prisma/client";
import { Logo } from "@/components/logo";
import { Money } from "@/components/money";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<GoalStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
};

function groupByType<T extends { type: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.type) ?? [];
    list.push(item);
    groups.set(item.type, list);
  }
  return groups;
}

export default async function FinancialStatementPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const [user, worth, goals] = await Promise.all([
    findUserById(userId),
    getWorthOverviewForUser(userId),
    getGoalsOverviewForUser(userId, todayIst()),
  ]);
  if (!user) {
    redirect("/sign-in");
  }

  const { netWorth, ownershipSplit, accounts, assets, liabilities } = worth;
  const hasJointHoldings = !ownershipSplit.joint.totalAssets.isZero() || !ownershipSplit.joint.totalLiabilities.isZero();
  const assetGroups = groupByType<Asset>(assets);
  const liabilityGroups = groupByType<Liability>(liabilities);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10 print:gap-6 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Button render={<Link href="/worth" />} nativeButton={false} variant="ghost" size="sm">
          <ArrowLeft /> Back to Worth
        </Button>
        <PrintButton />
      </div>

      <div className="flex items-start justify-between border-b pb-6">
        <div>
          <Logo />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Financial Statement</h1>
          <p className="text-muted-foreground mt-1 text-sm">{user.name}</p>
        </div>
        <p className="text-muted-foreground text-right text-sm">
          Generated {formatLongDate(todayIst())}
          <br />
          All figures in INR
        </p>
      </div>

      <section className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Net worth</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">
            <Money value={netWorth.netWorth} colorize />
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Total assets</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">
            <Money value={netWorth.totalAssets} />
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Total liabilities</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">
            <Money value={netWorth.totalLiabilities} />
          </p>
        </div>
      </section>

      {hasJointHoldings ? (
        <section>
          <h2 className="text-sm font-medium tracking-tight">By ownership</h2>
          <div className="mt-3 grid grid-cols-2 gap-6 text-sm">
            {(
              [
                ["Individual", ownershipSplit.individual],
                ["Joint", ownershipSplit.joint],
              ] as const
            ).map(([label, result]) => (
              <div key={label}>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
                <p className="mt-1 font-medium">
                  <Money value={result.netWorth} colorize />
                </p>
                <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
                  <div className="flex justify-between">
                    <span>Assets</span>
                    <Money value={result.totalAssets} />
                  </div>
                  <div className="flex justify-between">
                    <span>Liabilities</span>
                    <Money value={result.totalLiabilities} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium tracking-tight">Accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">None on record.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1.5 pr-4 font-medium">Name</th>
                <th className="py-1.5 pr-4 font-medium">Type</th>
                <th className="py-1.5 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b">
                  <td className="py-1.5 pr-4">
                    {account.name}
                    {account.isJoint ? <span className="text-muted-foreground"> · Joint</span> : null}
                  </td>
                  <td className="text-muted-foreground py-1.5 pr-4">{ACCOUNT_TYPE_LABELS[account.type]}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    <Money value={account.currentBalance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium tracking-tight">Assets</h2>
        {assets.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">None on record.</p>
        ) : (
          Array.from(assetGroups.entries()).map(([type, items]) => (
            <table key={type} className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1.5 pr-4 font-medium">
                    {ASSET_TYPE_LABELS[type as keyof typeof ASSET_TYPE_LABELS]}
                  </th>
                  <th className="py-1.5 text-right font-medium">
                    <Money value={sum(items.map((i) => i.currentValue))} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((asset) => (
                  <tr key={asset.id} className="border-b">
                    <td className="py-1.5 pr-4">
                      {asset.name}
                      {asset.isJoint ? <span className="text-muted-foreground"> · Joint</span> : null}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      <Money value={asset.currentValue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium tracking-tight">Liabilities</h2>
        {liabilities.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">None on record.</p>
        ) : (
          Array.from(liabilityGroups.entries()).map(([type, items]) => (
            <table key={type} className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1.5 pr-4 font-medium">
                    {LIABILITY_TYPE_LABELS[type as keyof typeof LIABILITY_TYPE_LABELS]}
                  </th>
                  <th className="py-1.5 text-right font-medium">
                    <Money value={sum(items.map((i) => i.outstandingPrincipal))} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((liability) => (
                  <tr key={liability.id} className="border-b">
                    <td className="py-1.5 pr-4">
                      {liability.name}
                      <span className="text-muted-foreground">
                        {" "}
                        · {liability.annualInterestRatePercent.toString()}%
                        {liability.isJoint ? " · Joint" : ""}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      <Money value={liability.outstandingPrincipal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))
        )}
      </section>

      {goals.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium tracking-tight">Goals</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1.5 pr-4 font-medium">Name</th>
                <th className="py-1.5 pr-4 font-medium">Target date</th>
                <th className="py-1.5 pr-4 font-medium">Status</th>
                <th className="py-1.5 text-right font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((goal) => (
                <tr key={goal.id} className="border-b">
                  <td className="py-1.5 pr-4">{goal.name}</td>
                  <td className="text-muted-foreground py-1.5 pr-4">{formatLongDate(goal.targetDate)}</td>
                  <td className="py-1.5 pr-4">{STATUS_LABEL[goal.projection.status]}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {goal.projection.progressPercent.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <p className="text-muted-foreground border-t pt-4 text-xs">
        Generated by Headroom on {formatLongDate(todayIst())}. Figures reflect balances as entered — not a
        certified or audited statement.
      </p>
    </div>
  );
}
