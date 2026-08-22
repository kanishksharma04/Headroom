import { auth } from "@/lib/auth";
import { getAmortisationScheduleForLiability } from "@/lib/services/liability-service";
import { NotFoundError } from "@/lib/services/account-service";
import { buildAmortisationScheduleCsv } from "@/lib/export/amortisation-schedule-csv";

function csvFilenameFor(liabilityName: string): string {
  const slug = liabilityName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "loan"}-schedule.csv`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Not authenticated.", { status: 401 });
  }

  const { id } = await params;

  let liability, schedule;
  try {
    ({ liability, schedule } = await getAmortisationScheduleForLiability(userId, id));
  } catch (error) {
    if (error instanceof NotFoundError) {
      return new Response("Not found.", { status: 404 });
    }
    throw error;
  }

  const csv = buildAmortisationScheduleCsv(schedule.periods);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilenameFor(liability.name)}"`,
    },
  });
}
