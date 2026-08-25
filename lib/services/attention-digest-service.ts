import { findAllUsers } from "@/lib/repositories/user-repository";
import { getTodayOverviewForUser } from "@/lib/services/headroom-service";
import { buildAttentionDigestEmail } from "@/lib/email/attention-digest";
import { sendEmail } from "@/lib/email/send-email";
import { pushToAllDevices } from "@/lib/push/push-to-all-devices";
import { resolveAppUrl } from "@/lib/app-url";

export type AttentionDigestResult = {
  userId: string;
  itemCount: number;
  sent: boolean;
  pushedDeviceCount: number;
};

/**
 * Sends one user their daily attention digest — only if they actually have
 * something to be told. A quiet day means no email or push at all, never
 * an "everything's fine" message; the in-app banner already covers that
 * case for anyone who does open the app. Email and push are independent
 * channels sent to the same trigger — a user gets both if they've set up
 * both, one if they've set up one, and this never treats either as a
 * fallback for the other.
 */
export async function sendAttentionDigestForUser(
  user: { id: string; name: string; email: string },
  now: Date,
): Promise<AttentionDigestResult> {
  const { attentionItems } = await getTodayOverviewForUser(user.id, now);
  if (attentionItems.length === 0) {
    return { userId: user.id, itemCount: 0, sent: false, pushedDeviceCount: 0 };
  }

  const appUrl = resolveAppUrl();
  const { subject, html, text } = buildAttentionDigestEmail(user.name, attentionItems, appUrl);
  const pushTitle =
    attentionItems.length === 1
      ? "Headroom: 1 thing needs your attention"
      : `Headroom: ${attentionItems.length} things need your attention`;
  const [{ sent }, pushedDeviceCount] = await Promise.all([
    sendEmail({ to: user.email, subject, html, text }),
    pushToAllDevices(user.id, pushTitle, attentionItems[0].message, `${appUrl}/today`),
  ]);

  return { userId: user.id, itemCount: attentionItems.length, sent, pushedDeviceCount };
}

/**
 * Runs the digest for every user, one at a time — sequential rather than
 * parallel so a burst of sends doesn't trip the email provider's rate
 * limit. Meant to be called once a day from the cron route.
 */
export async function sendAttentionDigestForAllUsers(now: Date): Promise<AttentionDigestResult[]> {
  const users = await findAllUsers();
  const results: AttentionDigestResult[] = [];
  for (const user of users) {
    results.push(await sendAttentionDigestForUser(user, now));
  }
  return results;
}
