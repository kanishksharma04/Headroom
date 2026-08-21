"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { goalFormSchema } from "@/lib/validation/goal";
import { addGoalForUser, editGoalForUser, removeGoalForUser } from "@/lib/services/goal-service";

export type FormState = { error?: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form for errors.";
}

function parseGoalForm(formData: FormData) {
  return goalFormSchema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount"),
    targetDate: formData.get("targetDate"),
    monthlyContribution: formData.get("monthlyContribution"),
    expectedAnnualReturnPercent: formData.get("expectedAnnualReturnPercent"),
    inflationPercent: formData.get("inflationPercent"),
  });
}

export async function createGoalAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseGoalForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  await addGoalForUser(userId, parsed.data);
  revalidatePath("/goals");
  revalidatePath("/records");
  revalidatePath("/decide");
  return {};
}

export async function updateGoalAction(
  goalId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseGoalForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  await editGoalForUser(userId, goalId, parsed.data);
  revalidatePath("/goals");
  revalidatePath("/records");
  revalidatePath("/decide");
  return {};
}

export async function deleteGoalAction(goalId: string): Promise<void> {
  const userId = await requireUserId();
  await removeGoalForUser(userId, goalId);
  revalidatePath("/goals");
  revalidatePath("/records");
  revalidatePath("/decide");
}
