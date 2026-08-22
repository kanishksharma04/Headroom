import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAmortisationScheduleForLiability } from "@/lib/services/liability-service";
import { NotFoundError } from "@/lib/services/account-service";
import { formatLongDate, formatShortDate } from "@/lib/format-date";
import { Money } from "@/components/money";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";

export default async function LiabilityAmortisationSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  let liability, schedule;
  try {
    ({ liability, schedule } = await getAmortisationScheduleForLiability(userId, id));
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between print:hidden">
        <Button render={<Link href="/worth" />} nativeButton={false} variant="ghost" size="sm">
          <ArrowLeft /> Back to Worth
        </Button>
        <div className="flex items-center gap-2">
          <Button
            render={<a href={`/api/export/liabilities/${liability.id}/schedule`} />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <Download /> Download CSV
          </Button>
          <PrintButton />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{liability.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {liability.annualInterestRatePercent.toString()}% · {schedule.periods.length} instalments ·{" "}
          {formatLongDate(schedule.periods[0].dueDate)} to {formatLongDate(schedule.payoffDate)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">EMI</p>
          <p className="font-medium">
            <Money value={schedule.emi} />
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Total interest</p>
          <p className="font-medium">
            <Money value={schedule.totalInterest} />
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Total paid</p>
          <p className="font-medium">
            <Money value={schedule.totalPaid} />
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 font-medium">#</th>
              <th className="py-2 pr-4 font-medium">Due date</th>
              <th className="py-2 pr-4 text-right font-medium">Opening</th>
              <th className="py-2 pr-4 text-right font-medium">EMI</th>
              <th className="py-2 pr-4 text-right font-medium">Interest</th>
              <th className="py-2 pr-4 text-right font-medium">Principal</th>
              <th className="py-2 text-right font-medium">Closing</th>
            </tr>
          </thead>
          <tbody>
            {schedule.periods.map((period) => (
              <tr key={period.period} className="border-b">
                <td className="text-muted-foreground py-1.5 pr-4">{period.period}</td>
                <td className="py-1.5 pr-4">{formatShortDate(period.dueDate)}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  <Money value={period.openingBalance} />
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  <Money value={period.emi} />
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  <Money value={period.interest} />
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  <Money value={period.principal} />
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  <Money value={period.closingBalance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
