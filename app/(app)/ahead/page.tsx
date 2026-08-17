import { redirect } from "next/navigation";
import { Link2, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { listCommitmentsForUser } from "@/lib/services/commitment-service";
import { getVariableSpendBaselineForUser } from "@/lib/services/variable-spend-service";
import {
  COMMITMENT_CATEGORY_LABELS,
  COMMITMENT_FREQUENCY_LABELS,
} from "@/lib/validation/commitment";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { deleteCommitmentAction } from "./actions";
import { AddEntityDialog } from "@/components/forms/add-entity-dialog";
import { CommitmentForm } from "@/components/forms/commitment-form";
import { VariableSpendForm } from "@/components/forms/variable-spend-form";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AheadPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const [commitments, variableSpend] = await Promise.all([
    listCommitmentsForUser(userId),
    getVariableSpendBaselineForUser(userId),
  ]);

  const todayIso = toIstDateInputValue(todayIst());

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ahead</h1>
        <p className="text-muted-foreground mt-1 text-sm">What&apos;s coming.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variable spend</CardTitle>
        </CardHeader>
        <CardContent>
          <VariableSpendForm currentAmount={variableSpend?.monthlyAmount.toString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Commitments</CardTitle>
          <AddEntityDialog triggerLabel="Add commitment" title="Add commitment">
            <CommitmentForm todayIso={todayIso} />
          </AddEntityDialog>
        </CardHeader>
        <CardContent>
          {commitments.length === 0 ? (
            <EmptyState
              title="No commitments yet"
              description="Add rent, SIPs, insurance premiums and subscriptions so the Headroom Number can net them out."
            />
          ) : (
            <ul className="divide-y">
              {commitments.map((commitment) => (
                <li key={commitment.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {commitment.name}
                      {commitment.linkedLiabilityId ? (
                        <Link2
                          className="text-muted-foreground size-3.5"
                          aria-label="Derived from a loan"
                        />
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {COMMITMENT_CATEGORY_LABELS[commitment.category]} ·{" "}
                      {COMMITMENT_FREQUENCY_LABELS[commitment.frequency]}
                      {!commitment.isActive ? " · Inactive" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money
                      value={commitment.amount}
                      showSign={commitment.direction === "INFLOW"}
                      className="text-sm font-medium"
                    />
                    {commitment.linkedLiabilityId ? (
                      <span className="text-muted-foreground w-9 text-center text-xs">—</span>
                    ) : (
                      <form action={deleteCommitmentAction.bind(null, commitment.id)}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="submit"
                          aria-label={`Delete ${commitment.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </form>
                    )}
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
