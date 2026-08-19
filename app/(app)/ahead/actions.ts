"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { commitmentFormSchema } from "@/lib/validation/commitment";
import { variableSpendFormSchema } from "@/lib/validation/variable-spend";
import {
  addCommitmentForUser,
  editCommitmentForUser,
  removeCommitmentForUser,
  setCommitmentActiveForUser,
} from "@/lib/services/commitment-service";
import { setVariableSpendBaselineForUser } from "@/lib/services/variable-spend-service";

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

function parseCommitmentForm(formData: FormData) {
  return commitmentFormSchema.safeParse({
    name: formData.get("name"),
    direction: formData.get("direction"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    isVariable: formData.get("isVariable") === "on",
    frequency: formData.get("frequency"),
    anchorDate: formData.get("anchorDate"),
    dayOfMonth: formData.get("dayOfMonth"),
    endDate: formData.get("endDate"),
  });
}

export async function createCommitmentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseCommitmentForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  await addCommitmentForUser(userId, parsed.data);
  revalidatePath("/ahead");
  revalidatePath("/records");
  return {};
}

export async function updateCommitmentAction(
  commitmentId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseCommitmentForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  await editCommitmentForUser(userId, commitmentId, parsed.data);
  revalidatePath("/ahead");
  revalidatePath("/records");
  return {};
}

export async function deleteCommitmentAction(commitmentId: string): Promise<void> {
  const userId = await requireUserId();
  await removeCommitmentForUser(userId, commitmentId);
  revalidatePath("/ahead");
  revalidatePath("/records");
}

export async function toggleCommitmentActiveAction(
  commitmentId: string,
  isActive: boolean,
): Promise<void> {
  const userId = await requireUserId();
  await setCommitmentActiveForUser(userId, commitmentId, isActive);
  revalidatePath("/ahead");
}

export async function setVariableSpendAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = variableSpendFormSchema.safeParse({
    monthlyAmount: formData.get("monthlyAmount"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  await setVariableSpendBaselineForUser(userId, parsed.data);
  revalidatePath("/ahead");
  return {};
}
