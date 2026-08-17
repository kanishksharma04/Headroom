import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { calculateNetWorth } from "@/lib/engines/networth";
import { listAccountsForUser } from "@/lib/services/account-service";
import { listAssetsForUser } from "@/lib/services/asset-service";
import { listLiabilitiesForUser } from "@/lib/services/liability-service";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validation/account";
import { ASSET_TYPE_LABELS } from "@/lib/validation/asset";
import { LIABILITY_TYPE_LABELS } from "@/lib/validation/liability";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { deleteAccountAction, deleteAssetAction, deleteLiabilityAction } from "./actions";
import { AddEntityDialog } from "@/components/forms/add-entity-dialog";
import { AccountForm } from "@/components/forms/account-form";
import { AssetForm } from "@/components/forms/asset-form";
import { LiabilityForm } from "@/components/forms/liability-form";
import { StatCard } from "@/components/stat-card";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function WorthPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const [accounts, assets, liabilities] = await Promise.all([
    listAccountsForUser(userId),
    listAssetsForUser(userId),
    listLiabilitiesForUser(userId),
  ]);

  const netWorth = calculateNetWorth({
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    assets: assets.map((a) => ({ currentValue: a.currentValue })),
    liabilities: liabilities.map((l) => ({ outstandingPrincipal: l.outstandingPrincipal })),
  });

  const todayIso = toIstDateInputValue(todayIst());

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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Accounts</CardTitle>
          <AddEntityDialog triggerLabel="Add account" title="Add account">
            <AccountForm todayIso={todayIso} />
          </AddEntityDialog>
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
            <ul className="divide-y">
              {assets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{asset.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {ASSET_TYPE_LABELS[asset.type]}
                      {asset.isJoint ? " · Joint" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money value={asset.currentValue} className="text-sm font-medium" />
                    <form action={deleteAssetAction.bind(null, asset.id)}>
                      <Button variant="ghost" size="icon-sm" type="submit" aria-label={`Delete ${asset.name}`}>
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
            <ul className="divide-y">
              {liabilities.map((liability) => (
                <li key={liability.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{liability.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {LIABILITY_TYPE_LABELS[liability.type]} · {liability.annualInterestRatePercent.toString()}%
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money value={liability.outstandingPrincipal} className="text-sm font-medium" />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
