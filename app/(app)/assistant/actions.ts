"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { updateUser } from "@/lib/repositories/user-repository";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

export async function toggleWeeklyAskSummaryAction(nextValue: boolean): Promise<void> {
  const userId = await requireUserId();
  await updateUser(userId, { weeklyAskSummaryEnabled: nextValue });
  revalidatePath("/assistant");
}
