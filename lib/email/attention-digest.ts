import type { AttentionItem } from "@/lib/engines/attention";

export type AttentionDigestEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds the daily attention digest email — the same items and messages
 * the in-app attention banner shows, reused verbatim rather than
 * reworded, so the email and the app never disagree about what's wrong.
 * Callers should only send this when `items` is non-empty; there is no
 * "all clear" variant, since a quiet day should mean no email at all.
 */
export function buildAttentionDigestEmail(
  userName: string,
  items: AttentionItem[],
  appUrl: string,
): AttentionDigestEmail {
  const subject =
    items.length === 1
      ? "Headroom: 1 thing needs your attention"
      : `Headroom: ${items.length} things need your attention`;

  const greeting = `Hi ${userName},`;
  const intro = "Here's what Headroom flagged today:";
  const outroText = `Open Headroom to see the full picture: ${appUrl}/today`;

  const text = [greeting, "", intro, "", ...items.map((item) => `- ${item.message}`), "", outroText].join(
    "\n",
  );

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    "<ul>",
    ...items.map((item) => `  <li>${escapeHtml(item.message)}</li>`),
    "</ul>",
    `<p><a href="${escapeHtml(appUrl)}/today">Open Headroom</a></p>`,
  ].join("\n");

  return { subject, html, text };
}
