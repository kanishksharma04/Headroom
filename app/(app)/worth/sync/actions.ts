"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { toIstDateInputValue } from "@/lib/dates";
import { findAccountById } from "@/lib/repositories/account-repository";
import { editAccountForUser, NotFoundError } from "@/lib/services/account-service";
import { addCommitmentForUser, listCommitmentsForUser } from "@/lib/services/commitment-service";
import { parseStatementCsv } from "@/lib/import/statement-csv";
import {
  detectRecurringCommitments,
  excludeAlreadyTrackedCommitments,
  suggestAccountBalance,
} from "@/lib/import/detect-commitments";
import { importedCommitmentRowSchema, type ImportedCommitmentRowInput } from "@/lib/validation/onboarding-import";
import type { AccountFormInput } from "@/lib/validation/account";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ResyncCommitmentSuggestion = {
  name: string;
  direction: string;
  category: string;
  amount: string;
  frequency: string;
  anchorDate: string;
  dayOfMonth: number;
  occurrenceCount: number;
};

export type ParseResyncState = {
  error?: string;
  accountId?: string;
  accountBalance?: string;
  accountBalanceAsOf?: string;
  commitments?: ResyncCommitmentSuggestion[];
};

/**
 * Parses an uploaded CSV against one already-chosen account: suggests a
 * balance update and any recurring payment the account doesn't already
 * have tracked. Nothing is saved here — {@link confirmResyncAction} does
 * that, and only for what the user has reviewed and kept checked.
 */
export async function parseResyncStatementAction(
  _prevState: ParseResyncState,
  formData: FormData,
): Promise<ParseResyncState> {
  const userId = await requireUserId();

  const accountId = formData.get("accountId");
  if (typeof accountId !== "string" || accountId.length === 0) {
    return { error: "Choose which account this statement is for." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to import." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "That file is larger than 2MB — export a shorter date range and try again." };
  }

  const text = await file.text();
  const parsed = parseStatementCsv(text);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const balanceSuggestion = suggestAccountBalance(parsed.transactions);
  const detected = detectRecurringCommitments(parsed.transactions);
  const existing = await listCommitmentsForUser(userId, { activeOnly: true });
  const commitmentSuggestions = excludeAlreadyTrackedCommitments(detected, existing);

  if (!balanceSuggestion && commitmentSuggestions.length === 0) {
    return {
      accountId,
      error:
        detected.length > commitmentSuggestions.length
          ? "Nothing new — every recurring payment in this file is already tracked, and no balance was found."
          : "Couldn't find a balance or any recurring payments in that file.",
    };
  }

  return {
    accountId,
    accountBalance: balanceSuggestion?.balance.toFixed(2),
    accountBalanceAsOf: balanceSuggestion ? toIstDateInputValue(balanceSuggestion.asOf) : undefined,
    commitments: commitmentSuggestions.map((c) => ({
      name: c.name,
      direction: c.direction,
      category: c.category,
      amount: c.amount.toFixed(2),
      frequency: c.frequency,
      anchorDate: toIstDateInputValue(c.anchorDate),
      dayOfMonth: c.dayOfMonth,
      occurrenceCount: c.occurrenceCount,
    })),
  };
}

export type ConfirmResyncState = { error?: string; success?: boolean };

export async function confirmResyncAction(
  _prevState: ConfirmResyncState,
  formData: FormData,
): Promise<ConfirmResyncState> {
  const userId = await requireUserId();

  const accountId = formData.get("accountId");
  if (typeof accountId !== "string" || accountId.length === 0) {
    return { error: "Choose which account this statement is for." };
  }

  if (formData.get("updateBalance") === "on") {
    const account = await findAccountById(accountId);
    if (!account || account.userId !== userId) {
      throw new NotFoundError("Account");
    }
    const accountBalance = formData.get("accountBalance");
    const accountBalanceAsOf = formData.get("accountBalanceAsOf");
    if (typeof accountBalance !== "string" || typeof accountBalanceAsOf !== "string") {
      return { error: "Check the balance fields." };
    }
    const input: AccountFormInput = {
      name: account.name,
      type: account.type,
      currentBalance: accountBalance,
      isJoint: account.isJoint,
      balanceAsOf: new Date(accountBalanceAsOf),
    };
    await editAccountForUser(userId, accountId, input);
  }

  const rowCount = Number(formData.get("commitmentCount") ?? 0);
  const commitments: ImportedCommitmentRowInput[] = [];
  for (let i = 0; i < rowCount; i++) {
    if (formData.get(`commitment-${i}-included`) !== "on") {
      continue;
    }
    const row = importedCommitmentRowSchema.safeParse({
      name: formData.get(`commitment-${i}-name`),
      direction: formData.get(`commitment-${i}-direction`),
      category: formData.get(`commitment-${i}-category`),
      amount: formData.get(`commitment-${i}-amount`),
      frequency: formData.get(`commitment-${i}-frequency`),
      anchorDate: formData.get(`commitment-${i}-anchorDate`),
      dayOfMonth: formData.get(`commitment-${i}-dayOfMonth`),
    });
    if (!row.success) {
      return { error: `Row ${i + 1}: ${row.error.issues[0]?.message ?? "check this row."}` };
    }
    commitments.push(row.data);
  }

  for (const commitment of commitments) {
    await addCommitmentForUser(userId, {
      name: commitment.name,
      direction: commitment.direction,
      category: commitment.category,
      amount: commitment.amount,
      isVariable: false,
      frequency: commitment.frequency,
      anchorDate: commitment.anchorDate,
      dayOfMonth: commitment.dayOfMonth,
      endDate: undefined,
    });
  }

  redirect("/worth");
}
