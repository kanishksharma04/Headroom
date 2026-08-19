import { redirect } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { listAccountsForUser } from "@/lib/services/account-service";
import { listAssetsForUser } from "@/lib/services/asset-service";
import { listLiabilitiesForUser } from "@/lib/services/liability-service";
import { listCommitmentsForUser } from "@/lib/services/commitment-service";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validation/account";
import { ASSET_TYPE_LABELS } from "@/lib/validation/asset";
import { LIABILITY_TYPE_LABELS } from "@/lib/validation/liability";
import { COMMITMENT_CATEGORY_LABELS, COMMITMENT_FREQUENCY_LABELS } from "@/lib/validation/commitment";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { deleteAccountAction, deleteAssetAction, deleteLiabilityAction } from "@/app/(app)/worth/actions";
import { deleteCommitmentAction } from "@/app/(app)/ahead/actions";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditEntityDialog } from "@/components/forms/edit-entity-dialog";
import { AccountForm } from "@/components/forms/account-form";
import { AssetForm } from "@/components/forms/asset-form";
import { LiabilityForm } from "@/components/forms/liability-form";
import { CommitmentForm } from "@/components/forms/commitment-form";
import { Money } from "@/components/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  Account,
  Asset,
  Commitment,
  Liability,
} from "@/lib/generated/prisma/client";

function matches(name: string, query: string): boolean {
  return query === "" || name.toLowerCase().includes(query);
}

function DeleteButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <Button variant="ghost" size="icon-sm" type="submit" aria-label={label}>
        <Trash2 />
      </Button>
    </form>
  );
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const todayIso = toIstDateInputValue(todayIst());

  const [accounts, assets, liabilities, commitments] = await Promise.all([
    listAccountsForUser(userId),
    listAssetsForUser(userId),
    listLiabilitiesForUser(userId),
    listCommitmentsForUser(userId),
  ]);

  const filteredAccounts = accounts.filter((a) => matches(a.name, query));
  const filteredAssets = assets.filter((a) => matches(a.name, query));
  const filteredLiabilities = liabilities.filter((l) => matches(l.name, query));
  const filteredCommitments = commitments.filter((c) => matches(c.name, query));

  const accountColumns: DataTableColumn<Account>[] = [
    { key: "name", header: "Name", render: (a) => a.name },
    { key: "type", header: "Type", render: (a) => ACCOUNT_TYPE_LABELS[a.type] },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (a) => <Money value={a.currentBalance} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => (
        <div className="flex justify-end gap-1">
          <EditEntityDialog title="Edit account" label={`Edit ${a.name}`}>
            <AccountForm
              todayIso={todayIso}
              existing={{
                id: a.id,
                name: a.name,
                type: a.type,
                currentBalance: a.currentBalance.toString(),
                isJoint: a.isJoint,
                balanceAsOf: toIstDateInputValue(a.balanceAsOf),
              }}
            />
          </EditEntityDialog>
          <DeleteButton action={deleteAccountAction.bind(null, a.id)} label={`Delete ${a.name}`} />
        </div>
      ),
    },
  ];

  const assetColumns: DataTableColumn<Asset>[] = [
    { key: "name", header: "Name", render: (a) => a.name },
    { key: "type", header: "Type", render: (a) => ASSET_TYPE_LABELS[a.type] },
    {
      key: "value",
      header: "Current value",
      align: "right",
      render: (a) => <Money value={a.currentValue} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => (
        <div className="flex justify-end gap-1">
          <EditEntityDialog title="Edit asset" label={`Edit ${a.name}`}>
            <AssetForm
              todayIso={todayIso}
              existing={{
                id: a.id,
                name: a.name,
                type: a.type,
                investedAmount: a.investedAmount.toString(),
                currentValue: a.currentValue.toString(),
                valuationAsOf: toIstDateInputValue(a.valuationAsOf),
                expectedAnnualReturnPercent: a.expectedAnnualReturnPercent?.toString() ?? null,
                isJoint: a.isJoint,
                notes: a.notes,
              }}
            />
          </EditEntityDialog>
          <DeleteButton action={deleteAssetAction.bind(null, a.id)} label={`Delete ${a.name}`} />
        </div>
      ),
    },
  ];

  const liabilityColumns: DataTableColumn<Liability>[] = [
    { key: "name", header: "Name", render: (l) => l.name },
    { key: "type", header: "Type", render: (l) => LIABILITY_TYPE_LABELS[l.type] },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      render: (l) => `${l.annualInterestRatePercent.toString()}%`,
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      render: (l) => <Money value={l.outstandingPrincipal} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div className="flex justify-end gap-1">
          <EditEntityDialog title="Edit liability" label={`Edit ${l.name}`}>
            <LiabilityForm
              todayIso={todayIso}
              existing={{
                id: l.id,
                name: l.name,
                type: l.type,
                principalAmount: l.principalAmount.toString(),
                annualInterestRatePercent: l.annualInterestRatePercent.toString(),
                startDate: toIstDateInputValue(l.startDate),
                tenureMonths: l.tenureMonths,
                emiAmount: l.emiAmount.toString(),
                emiDayOfMonth: l.emiDayOfMonth,
                outstandingPrincipal: l.outstandingPrincipal.toString(),
                outstandingAsOf: toIstDateInputValue(l.outstandingAsOf),
                prepaymentPenaltyPercent: l.prepaymentPenaltyPercent?.toString() ?? null,
                isTaxDeductible: l.isTaxDeductible,
                isSelfOccupied: l.isSelfOccupied,
              }}
            />
          </EditEntityDialog>
          <DeleteButton action={deleteLiabilityAction.bind(null, l.id)} label={`Delete ${l.name}`} />
        </div>
      ),
    },
  ];

  const commitmentColumns: DataTableColumn<Commitment>[] = [
    { key: "name", header: "Name", render: (c) => c.name },
    { key: "category", header: "Category", render: (c) => COMMITMENT_CATEGORY_LABELS[c.category] },
    { key: "frequency", header: "Frequency", render: (c) => COMMITMENT_FREQUENCY_LABELS[c.frequency] },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (c) => <Money value={c.amount} showSign={c.direction === "INFLOW"} colorize />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) =>
        c.linkedLiabilityId ? (
          <span className="text-muted-foreground text-xs">From loan</span>
        ) : (
          <div className="flex justify-end gap-1">
            <EditEntityDialog title="Edit commitment" label={`Edit ${c.name}`}>
              <CommitmentForm
                todayIso={todayIso}
                existing={{
                  id: c.id,
                  name: c.name,
                  direction: c.direction,
                  category: c.category,
                  amount: c.amount.toString(),
                  frequency: c.frequency,
                  anchorDate: toIstDateInputValue(c.anchorDate),
                  dayOfMonth: c.dayOfMonth,
                  endDate: c.endDate ? toIstDateInputValue(c.endDate) : null,
                  isVariable: c.isVariable,
                }}
              />
            </EditEntityDialog>
            <DeleteButton action={deleteCommitmentAction.bind(null, c.id)} label={`Delete ${c.name}`} />
          </div>
        ),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Records</h1>
        <p className="text-muted-foreground mt-1 text-sm">Every underlying entity, for verification.</p>
      </div>

      <form className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          name="q"
          placeholder="Search by name…"
          defaultValue={q}
          className="pl-9"
        />
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={accountColumns}
            rows={filteredAccounts}
            getRowKey={(a) => a.id}
            emptyMessage={query ? "No accounts match your search." : "No accounts yet."}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={assetColumns}
            rows={filteredAssets}
            getRowKey={(a) => a.id}
            emptyMessage={query ? "No assets match your search." : "No assets yet."}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={liabilityColumns}
            rows={filteredLiabilities}
            getRowKey={(l) => l.id}
            emptyMessage={query ? "No liabilities match your search." : "No liabilities yet."}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commitments</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={commitmentColumns}
            rows={filteredCommitments}
            getRowKey={(c) => c.id}
            emptyMessage={query ? "No commitments match your search." : "No commitments yet."}
          />
        </CardContent>
      </Card>
    </div>
  );
}
