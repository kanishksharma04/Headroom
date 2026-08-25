import webpush from "web-push";

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** The public key the client needs to call `pushManager.subscribe()` — null when push isn't configured. */
export function getPushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let configured = false;

function configureOnce(): boolean {
  if (configured) {
    return true;
  }
  if (!isPushConfigured()) {
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:notifications@headroom.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string };

/**
 * Sends one push notification, or silently no-ops when VAPID keys aren't
 * configured — mirrors lib/email/send-email.ts's lazy pattern, so local
 * dev and unconfigured deployments keep working without this ever
 * throwing. `expired: true` means the push service reports the
 * subscription is dead (410 Gone / 404) — the caller should delete it.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionInput,
  payload: PushPayload,
): Promise<{ sent: boolean; expired: boolean }> {
  if (!configureOnce()) {
    console.warn(`VAPID keys are not set — skipping push to ${subscription.endpoint}`);
    return { sent: false, expired: false };
  }

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
    );
    return { sent: true, expired: false };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return { sent: false, expired: true };
    }
    console.error("Failed to send push notification:", error);
    return { sent: false, expired: false };
  }
}
