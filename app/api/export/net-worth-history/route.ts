import { auth } from "@/lib/auth";
import { getNetWorthHistoryForUser } from "@/lib/services/networth-snapshot-service";
import { buildNetWorthHistoryCsv } from "@/lib/export/net-worth-history-csv";

export async function GET(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Not authenticated.", { status: 401 });
  }

  const history = await getNetWorthHistoryForUser(userId);
  const csv = buildNetWorthHistoryCsv(history);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="net-worth-history.csv"',
    },
  });
}
