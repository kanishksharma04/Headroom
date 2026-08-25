"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { householdInviteSchema } from "@/lib/validation/household";
import {
  acceptHouseholdInvite,
  declineHouseholdInvite,
  inviteToHousehold,
  revokeHouseholdInvite,
} from "@/lib/services/household-service";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

export type FormState = { error?: string };

export async function sendHouseholdInviteAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = householdInviteSchema.safeParse({ inviteeEmail: formData.get("inviteeEmail") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  try {
    await inviteToHousehold(userId, parsed.data.inviteeEmail);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't send that invite." };
  }

  revalidatePath("/household");
  return {};
}

export async function acceptHouseholdInviteAction(inviteId: string): Promise<void> {
  const userId = await requireUserId();
  await acceptHouseholdInvite(userId, inviteId);
  revalidatePath("/household");
}

export async function declineHouseholdInviteAction(inviteId: string): Promise<void> {
  const userId = await requireUserId();
  await declineHouseholdInvite(userId, inviteId);
  revalidatePath("/household");
}

export async function revokeHouseholdInviteAction(inviteId: string): Promise<void> {
  const userId = await requireUserId();
  await revokeHouseholdInvite(userId, inviteId);
  revalidatePath("/household");
}
