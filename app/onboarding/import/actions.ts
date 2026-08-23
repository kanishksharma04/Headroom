"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { toIstDateInputValue } from "@/lib/dates";
import { updateUser } from "@/lib/repositories/user-repository";
import { addAccountForUser } from "@/lib/services/account-service";
import { addCommitmentForUser } from "@/lib/services/commitment-service";
import { setVariableSpendBaselineForUser } from "@/lib/services/variable-spend-service";
import { parseStatementCsv } from "@/lib/import/statement-csv";
import { detectRecurringCommitments, suggestAccountBalance } from "@/lib/import/detect-commitments";
import {
  importedAccountSchema,
  importedCommitmentRowSchema,
  importedVariableSpendSchema,
  type ImportedCommitmentRowInput,
} from "@/lib/validation/onboarding-import";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ParsedCommitmentSuggestion = {
  name: string;
  direction: string;
  category: string;
  amount: string;
  frequency: string;
  anchorDate: string;
  dayOfMonth: number;
  occurrenceCount: number;
};

export type ParseStatementState = {
  error?: string;
  suggestedAccountName?: string;
  accountBalance?: string;
  accountBalanceAsOf?: string;
  commitments?: ParsedCommitmentSuggestion[];
};

function suggestAccountName(fileName: string): string {
  const cleaned = fileName
    .replace(/\.csv$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  return cleaned || "Bank Account";
}

/**
 * Parses an uploaded CSV entirely in memory and returns prefill
 * suggestions — the file itself, and every row of it, is discarded the
 * moment this returns. Nothing from the statement is persisted here;
 * {@link confirmImportedOnboardingAction} is what actually saves anything,
 * and only what the user has reviewed and confirmed.
 */
export async function parseStatementAction(
  _prevState: ParseStatementState,
  formData: FormData,
): Promise<ParseStatementState> {
  await requireUserId();

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
  const commitmentSuggestions = detectRecurringCommitments(parsed.transactions);

  if (!balanceSuggestion && commitmentSuggestions.length === 0) {
    return {
      error:
        "Couldn't find a balance or any recurring payments in that file. It needs a Balance column, or at least two statement cycles so a repeating payment can be recognised.",
    };
  }

  return {
    suggestedAccountName: suggestAccountName(file.name),
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

export type ConfirmImportState = { error?: string };

export async function confirmImportedOnboardingAction(
  _prevState: ConfirmImportState,
  formData: FormData,
): Promise<ConfirmImportState> {
  const userId = await requireUserId();

  const account = importedAccountSchema.safeParse({
    accountName: formData.get("accountName"),
    accountType: formData.get("accountType"),
    accountBalance: formData.get("accountBalance"),
    accountBalanceAsOf: formData.get("accountBalanceAsOf"),
  });
  if (!account.success) {
    return { error: account.error.issues[0]?.message ?? "Check the account fields." };
  }

  const variableSpend = importedVariableSpendSchema.safeParse({
    variableSpendAmount: formData.get("variableSpendAmount"),
  });
  if (!variableSpend.success) {
    return { error: variableSpend.error.issues[0]?.message ?? "Enter a variable spend estimate." };
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

  await addAccountForUser(userId, {
    name: account.data.accountName,
    type: account.data.accountType,
    currentBalance: account.data.accountBalance,
    isJoint: false,
    balanceAsOf: account.data.accountBalanceAsOf,
  });

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

  const salaryCommitment = commitments.find((c) => c.category === "SALARY" && c.direction === "INFLOW");
  if (salaryCommitment) {
    await updateUser(userId, { salaryDayOfMonth: salaryCommitment.dayOfMonth });
  }

  await setVariableSpendBaselineForUser(userId, {
    monthlyAmount: variableSpend.data.variableSpendAmount,
  });

  redirect("/today");
}
