import { sendWeeklySummaryForAllOptedInUsers } from "@/lib/services/weekly-ask-summary-service";

/**
 * Triggered once a week by the Vercel Cron schedule in vercel.json. Same
 * fail-closed CRON_SECRET gate as the daily attention digest.
 */
export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const results = await sendWeeklySummaryForAllOptedInUsers();
  const sent = results.filter((r) => r.sent).length;
  const pushed = results.reduce((total, r) => total + r.pushedDeviceCount, 0);
  const failed = results.filter((r) => r.failed).length;

  return Response.json({ checked: results.length, sent, pushed, failed });
}
