import { Resend } from "resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "Headroom <notifications@headroom.app>";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) {
    return client;
  }
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/**
 * Sends an email via Resend, or silently no-ops when RESEND_API_KEY isn't
 * configured — local dev and any deployment that hasn't set up email
 * delivery yet keep working without this ever throwing.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean }> {
  const resend = getClient();
  if (!resend) {
    console.warn(`RESEND_API_KEY is not set — skipping email to ${input.to}: "${input.subject}"`);
    return { sent: false };
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    console.error("Failed to send email:", error);
    return { sent: false };
  }

  return { sent: true };
}
