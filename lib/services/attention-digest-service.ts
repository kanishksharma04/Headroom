import { findAllUsers } from "@/lib/repositories/user-repository";
import { getTodayOverviewForUser } from "@/lib/services/headroom-service";
import { buildAttentionDigestEmail } from "@/lib/email/attention-digest";
import { sendEmail } from "@/lib/email/send-email";

export type AttentionDigestResult = {
  userId: string;
  itemCount: number;
  sent: boolean;
};

function resolveAppUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Sends one user their daily attention digest — only if they actually have
 * something to be told. A quiet day means no email at all, never an
 * "everything's fine" message; the in-app banner already covers that case
 * for anyone who does open the app.
 */
export async function sendAttentionDigestForUser(
  user: { id: string; name: string; email: string },
  now: Date,
): Promise<AttentionDigestResult> {
  const { attentionItems } = await getTodayOverviewForUser(user.id, now);
  if (attentionItems.length === 0) {
    return { userId: user.id, itemCount: 0, sent: false };
  }

  const { subject, html, text } = buildAttentionDigestEmail(user.name, attentionItems, resolveAppUrl());
  const { sent } = await sendEmail({ to: user.email, subject, html, text });

  return { userId: user.id, itemCount: attentionItems.length, sent };
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
