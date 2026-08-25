"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTotpForUser,
} from "@/lib/services/auth-service";
import { totpCodeSchema, totpDisableSchema } from "@/lib/validation/auth";
import { subscribeUserToPush, unsubscribeFromPush } from "@/lib/services/push-subscription-service";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

export type EnrollmentState = {
  secret?: string;
  qrCodeDataUri?: string;
  error?: string;
};

/** No form fields — invoked directly by a button click, not bound via useActionState. */
export async function startTotpEnrollmentAction(): Promise<EnrollmentState> {
  const userId = await requireUserId();
  const { secret, uri } = await beginTotpEnrollment(userId);
  const qrCodeDataUri = await QRCode.toDataURL(uri);
  return { secret, qrCodeDataUri };
}

export type ConfirmEnrollmentState = {
  error?: string;
  backupCodes?: string[];
};

export async function confirmTotpEnrollmentAction(
  _prevState: ConfirmEnrollmentState,
  formData: FormData,
): Promise<ConfirmEnrollmentState> {
  const userId = await requireUserId();
  const parsed = totpCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid code." };
  }

  const result = await confirmTotpEnrollment(userId, parsed.data);
  if (!result) {
    return { error: "That code didn't match. Check your authenticator app and try again." };
  }

  // Deliberately no revalidatePath here: this page's server component reads
  // totpEnabled to decide which form to show, and revalidating now — before
  // the user has actually seen these backup codes — would immediately swap
  // this view out for the "turn it off" form, mid-render, and the codes
  // would never be shown at all. The client only refreshes the page once
  // the user has acknowledged saving them (see TotpEnrollment's Done button).
  return { backupCodes: result.backupCodes };
}

export type DisableTotpState = { error?: string };

export async function disableTotpAction(
  _prevState: DisableTotpState,
  formData: FormData,
): Promise<DisableTotpState> {
  const userId = await requireUserId();
  const parsed = totpDisableSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter your password." };
  }

  const ok = await disableTotpForUser(userId, parsed.data.password);
  if (!ok) {
    return { error: "Incorrect password." };
  }

  revalidatePath("/security");
  return {};
}

/** No form fields — invoked directly with the browser's PushSubscription, not bound via useActionState. */
export async function subscribeToPushAction(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<{ error?: string }> {
  const userId = await requireUserId();
  await subscribeUserToPush(userId, {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });
  return {};
}

export async function unsubscribeFromPushAction(endpoint: string): Promise<{ error?: string }> {
  await requireUserId();
  await unsubscribeFromPush(endpoint);
  return {};
}
