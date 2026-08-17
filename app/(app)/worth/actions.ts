"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { accountFormSchema } from "@/lib/validation/account";
import { assetFormSchema } from "@/lib/validation/asset";
import { liabilityFormSchema } from "@/lib/validation/liability";
import { addAccountForUser, removeAccountForUser } from "@/lib/services/account-service";
import { addAssetForUser, removeAssetForUser } from "@/lib/services/asset-service";
import { addLiabilityForUser, removeLiabilityForUser } from "@/lib/services/liability-service";

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

export async function createAccountAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = accountFormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currentBalance: formData.get("currentBalance"),
    isJoint: formData.get("isJoint") === "on",
    balanceAsOf: formData.get("balanceAsOf"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  await addAccountForUser(userId, parsed.data);
  revalidatePath("/worth");
  return {};
}

export async function deleteAccountAction(accountId: string): Promise<void> {
  const userId = await requireUserId();
  await removeAccountForUser(userId, accountId);
  revalidatePath("/worth");
}

export async function createAssetAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = assetFormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    investedAmount: formData.get("investedAmount"),
    currentValue: formData.get("currentValue"),
    valuationAsOf: formData.get("valuationAsOf"),
    expectedAnnualReturnPercent: formData.get("expectedAnnualReturnPercent"),
    isJoint: formData.get("isJoint") === "on",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  await addAssetForUser(userId, parsed.data);
  revalidatePath("/worth");
  return {};
}

export async function deleteAssetAction(assetId: string): Promise<void> {
  const userId = await requireUserId();
  await removeAssetForUser(userId, assetId);
  revalidatePath("/worth");
}

export async function createLiabilityAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = liabilityFormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    principalAmount: formData.get("principalAmount"),
    annualInterestRatePercent: formData.get("annualInterestRatePercent"),
    startDate: formData.get("startDate"),
    tenureMonths: formData.get("tenureMonths"),
    emiAmount: formData.get("emiAmount"),
    emiDayOfMonth: formData.get("emiDayOfMonth"),
    outstandingPrincipal: formData.get("outstandingPrincipal"),
    outstandingAsOf: formData.get("outstandingAsOf"),
    prepaymentPenaltyPercent: formData.get("prepaymentPenaltyPercent"),
    isTaxDeductible: formData.get("isTaxDeductible") === "on",
    isSelfOccupied: formData.get("isSelfOccupied") === "on",
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  await addLiabilityForUser(userId, parsed.data);
  revalidatePath("/worth");
  return {};
}

export async function deleteLiabilityAction(liabilityId: string): Promise<void> {
  const userId = await requireUserId();
  await removeLiabilityForUser(userId, liabilityId);
  revalidatePath("/worth");
}
