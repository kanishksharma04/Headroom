import { syncAllAssetPrices } from "@/lib/services/price-sync-service";

/**
 * Triggered once a day by the Vercel Cron schedule in vercel.json, after
 * AMFI's daily NAVs are typically published. Same fail-closed CRON_SECRET
 * gate as the other cron routes.
 */
export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const results = await syncAllAssetPrices();
  const synced = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return Response.json({ checked: results.length, synced, failed });
}
