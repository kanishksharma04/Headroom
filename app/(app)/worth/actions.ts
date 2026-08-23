"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { accountFormSchema } from "@/lib/validation/account";
import { assetFormSchema } from "@/lib/validation/asset";
import { liabilityFormSchema } from "@/lib/validation/liability";
import {
  addAccountForUser,
  editAccountForUser,
  removeAccountForUser,
} from "@/lib/services/account-service";
import { addAssetForUser, editAssetForUser, removeAssetForUser } from "@/lib/services/asset-service";
import {
  addLiabilityForUser,
  editLiabilityForUser,
  removeLiabilityForUser,
} from "@/lib/services/liability-service";

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

function parseAccountForm(formData: FormData) {
  return accountFormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currentBalance: formData.get("currentBalance"),
    isJoint: formData.get("isJoint") === "on",
    balanceAsOf: formData.get("balanceAsOf"),
  });
}

export async function createAccountAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseAccountForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  await addAccountForUser(userId, parsed.data);
  revalidatePath("/worth");
  revalidatePath("/records");
  return {};
}

export async function updateAccountAction(
  accountId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseAccountForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  await editAccountForUser(userId, accountId, parsed.data);
  revalidatePath("/worth");
  revalidatePath("/records");
  return {};
}

export async function deleteAccountAction(accountId: string): Promise<void> {
  const userId = await requireUserId();
  await removeAccountForUser(userId, accountId);
  revalidatePath("/worth");
  revalidatePath("/records");
}

function parseAssetForm(formData: FormData) {
  return assetFormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    investedAmount: formData.get("investedAmount"),
    currentValue: formData.get("currentValue"),
    valuationAsOf: formData.get("valuationAsOf"),
    expectedAnnualReturnPercent: formData.get("expectedAnnualReturnPercent"),
    isJoint: formData.get("isJoint") === "on",
    notes: formData.get("notes"),
  });
}

export async function createAssetAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  await addAssetForUser(userId, parsed.data);
  revalidatePath("/worth");
  revalidatePath("/records");
  return {};
}

export async function updateAssetAction(
  assetId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  await editAssetForUser(userId, assetId, parsed.data);
  revalidatePath("/worth");
  revalidatePath("/records");
  return {};
}

export async function deleteAssetAction(assetId: string): Promise<void> {
  const userId = await requireUserId();
  await removeAssetForUser(userId, assetId);
  revalidatePath("/worth");
  revalidatePath("/records");
}

function parseLiabilityForm(formData: FormData) {
  return liabilityFormSchema.safeParse({
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
    isJoint: formData.get("isJoint") === "on",
  });
}

export async function createLiabilityAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseLiabilityForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  await addLiabilityForUser(userId, parsed.data);
  revalidatePath("/worth");
  revalidatePath("/records");
  revalidatePath("/ahead");
  return {};
}

export async function updateLiabilityAction(
  liabilityId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = parseLiabilityForm(formData);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }
  await editLiabilityForUser(userId, liabilityId, parsed.data);
  revalidatePath("/worth");
  revalidatePath("/records");
  revalidatePath("/ahead");
  return {};
}

export async function deleteLiabilityAction(liabilityId: string): Promise<void> {
  const userId = await requireUserId();
  await removeLiabilityForUser(userId, liabilityId);
  revalidatePath("/worth");
  revalidatePath("/records");
  revalidatePath("/ahead");
}
