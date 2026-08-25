import { redirect } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { findUserById } from "@/lib/repositories/user-repository";
import { listLiabilitiesForUser } from "@/lib/services/liability-service";
import { listScenariosForUser } from "@/lib/services/scenario-service";
import { formatLongDate } from "@/lib/format-date";
import { PrepayVsInvestTool, type LiabilityOption } from "@/components/decide/prepay-vs-invest-tool";
import { RefinanceTool } from "@/components/decide/refinance-tool";
import { AffordabilityTool } from "@/components/decide/affordability-tool";
import { IncomeChangeTool } from "@/components/decide/income-change-tool";
import { JobLossTool } from "@/components/decide/job-loss-tool";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteScenarioAction } from "./actions";

export default async function DecidePage({
  searchParams,
}: {
  searchParams: Promise<{ liabilityId?: string; lumpSum?: string; mode?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const params = await searchParams;

  const [user, liabilities, scenarios] = await Promise.all([
    findUserById(userId),
    listLiabilitiesForUser(userId),
    listScenariosForUser(userId),
  ]);
  if (!user) {
    redirect("/sign-in");
  }

  const liabilityOptions: LiabilityOption[] = liabilities.map((l) => ({
    id: l.id,
    name: l.name,
    outstandingPrincipal: l.outstandingPrincipal.toString(),
    annualInterestRatePercent: l.annualInterestRatePercent.toString(),
    emiAmount: l.emiAmount.toString(),
    emiDayOfMonth: l.emiDayOfMonth,
    startDate: l.startDate.toISOString(),
    tenureMonths: l.tenureMonths,
    isSelfOccupied: l.isSelfOccupied,
    prepaymentPenaltyPercent: l.prepaymentPenaltyPercent?.toString() ?? null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Decide</h1>
        <p className="text-muted-foreground mt-1 text-sm">What should I do?</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prepay vs invest</CardTitle>
        </CardHeader>
        <CardContent>
          {liabilityOptions.length === 0 ? (
            <EmptyState
              title="Add a loan to run this"
              description="Once you add a loan on Worth, you can model prepaying it against investing the same amount."
              action={
                <Button render={<Link href="/worth" />} nativeButton={false}>
                  Add a loan
                </Button>
              }
            />
          ) : (
            <PrepayVsInvestTool
              liabilities={liabilityOptions}
              taxProfile={{ regime: user.taxRegime, taxSlabPercent: user.taxSlabPercent.toString() }}
              defaultLiabilityId={params.liabilityId}
              defaultLumpSum={params.lumpSum}
              defaultMode={params.mode === "REDUCE_EMI" ? "REDUCE_EMI" : "REDUCE_TENURE"}
            />
          )}
        </CardContent>
      </Card>

      {scenarios.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {scenarios.map((scenario) => {
                const inputs = scenario.inputsJson as {
                  liabilityId: string;
                  lumpSum: string;
                  prepaymentMode: string;
                };
                return (
                  <li key={scenario.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <Link
                        href={`/decide?liabilityId=${inputs.liabilityId}&lumpSum=${inputs.lumpSum}&mode=${inputs.prepaymentMode}`}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {scenario.name}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        Saved {formatLongDate(scenario.createdAt)}
                      </p>
                    </div>
                    <form action={deleteScenarioAction.bind(null, scenario.id)}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="submit"
                        aria-label={`Delete ${scenario.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Should I refinance a loan?</CardTitle>
        </CardHeader>
        <CardContent>
          {liabilityOptions.length === 0 ? (
            <EmptyState
              title="Add a loan to run this"
              description="Once you add a loan on Worth, you can compare it against a rate another lender is offering."
              action={
                <Button render={<Link href="/worth" />} nativeButton={false}>
                  Add a loan
                </Button>
              }
            />
          ) : (
            <RefinanceTool liabilities={liabilityOptions} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Can I afford this?</CardTitle>
        </CardHeader>
        <CardContent>
          <AffordabilityTool />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What if my income changes?</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeChangeTool />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What if I lost my job today?</CardTitle>
        </CardHeader>
        <CardContent>
          <JobLossTool />
        </CardContent>
      </Card>
    </div>
  );
}
