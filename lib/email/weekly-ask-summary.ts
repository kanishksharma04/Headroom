export type WeeklyAskSummaryEmail = {
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
 * Builds the Monday weekly check-in email — the summary text is
 * Ask's own generated reply, reused verbatim, so the email never says
 * anything the in-app conversation wouldn't.
 */
export function buildWeeklyAskSummaryEmail(userName: string, summary: string, appUrl: string): WeeklyAskSummaryEmail {
  const subject = "Your weekly check-in from Headroom";
  const greeting = `Hi ${userName},`;
  const outroText = `See the full conversation, or ask a follow-up: ${appUrl}/assistant`;

  const text = [greeting, "", summary, "", outroText].join("\n");

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(summary)}</p>`,
    `<p><a href="${escapeHtml(appUrl)}/assistant">Open Ask</a></p>`,
  ].join("\n");

  return { subject, html, text };
}
