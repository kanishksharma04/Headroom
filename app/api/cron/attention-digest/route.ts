import { sendAttentionDigestForAllUsers } from "@/lib/services/attention-digest-service";

/**
 * Triggered once a day by the Vercel Cron schedule in vercel.json. Requires
 * CRON_SECRET to be set — with no exception for a missing/empty secret —
 * so a forgotten env var fails closed instead of leaving this endpoint
 * open for anyone to mass-email every user on demand.
 */
export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const results = await sendAttentionDigestForAllUsers(new Date());
  const sent = results.filter((r) => r.sent).length;

  return Response.json({ checked: results.length, sent });
}
