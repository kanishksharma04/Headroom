import { findUsersWithWeeklySummaryEnabled } from "@/lib/repositories/user-repository";
import { isAssistantConfigured } from "@/lib/ai/anthropic-client";
import { generateWeeklySummary } from "@/lib/services/assistant-service";
import { buildWeeklyAskSummaryEmail } from "@/lib/email/weekly-ask-summary";
import { sendEmail } from "@/lib/email/send-email";
import { pushToAllDevices } from "@/lib/push/push-to-all-devices";
import { resolveAppUrl } from "@/lib/app-url";

export type WeeklyAskSummaryResult = {
  userId: string;
  sent: boolean;
  pushedDeviceCount: number;
  failed: boolean;
};

/**
 * Sends one user their weekly Ask check-in — generating it fresh via
 * `generateWeeklySummary`, then delivering it over the same two
 * independent channels (email, push) the attention digest uses. Unlike
 * the digest's send functions, generating the summary itself calls the
 * Anthropic API and so genuinely can throw (network hiccup, rate limit);
 * that's reported as `failed` rather than left to crash the whole run.
 */
export async function sendWeeklySummaryForUser(
  user: { id: string; name: string; email: string },
): Promise<WeeklyAskSummaryResult> {
  let summary: string;
  try {
    summary = await generateWeeklySummary(user.id);
  } catch (error) {
    console.error(`Failed to generate weekly Ask summary for user ${user.id}:`, error);
    return { userId: user.id, sent: false, pushedDeviceCount: 0, failed: true };
  }

  const appUrl = resolveAppUrl();
  const { subject, html, text } = buildWeeklyAskSummaryEmail(user.name, summary, appUrl);
  const [{ sent }, pushedDeviceCount] = await Promise.all([
    sendEmail({ to: user.email, subject, html, text }),
    pushToAllDevices(user.id, "Your weekly check-in from Headroom", summary, `${appUrl}/assistant`),
  ]);

  return { userId: user.id, sent, pushedDeviceCount, failed: false };
}

/**
 * Runs the weekly summary for every opted-in user, one at a time. A no-op
 * entirely when Ask isn't configured for this deployment, since there
 * would be nothing to generate. Sequential, matching the attention
 * digest's pacing against the email provider's rate limit.
 */
export async function sendWeeklySummaryForAllOptedInUsers(): Promise<WeeklyAskSummaryResult[]> {
  if (!isAssistantConfigured()) {
    return [];
  }

  const users = await findUsersWithWeeklySummaryEnabled();
  const results: WeeklyAskSummaryResult[] = [];
  for (const user of users) {
    results.push(await sendWeeklySummaryForUser(user));
  }
  return results;
}
