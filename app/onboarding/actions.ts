"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getIstParts, resolveIstDateForDayOfMonth, todayIst } from "@/lib/dates";
import { updateUser } from "@/lib/repositories/user-repository";
import { addAccountForUser, listAccountsForUser } from "@/lib/services/account-service";
import { addLiabilityForUser } from "@/lib/services/liability-service";
import { addCommitmentForUser } from "@/lib/services/commitment-service";
import { setVariableSpendBaselineForUser } from "@/lib/services/variable-spend-service";
import {
  onboardingAccountSchema,
  onboardingLoanSchema,
  onboardingSalarySchema,
  onboardingVariableSpendSchema,
} from "@/lib/validation/onboarding";

export type OnboardingFormState = { error?: string };

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

export async function completeOnboardingAction(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const userId = await requireUserId();

  // Mirrors the page-level guard in app/onboarding/page.tsx: a submission
  // that lands after onboarding already completed (back button, double
  // submit, two tabs) sends the user on rather than creating a duplicate
  // account and commitment set.
  const existingAccounts = await listAccountsForUser(userId);
  if (existingAccounts.length > 0) {
    redirect("/today");
  }

  const salary = onboardingSalarySchema.safeParse({
    salaryAmount: formData.get("salaryAmount"),
    salaryDayOfMonth: formData.get("salaryDayOfMonth"),
  });
  if (!salary.success) {
    return { error: firstIssueMessage(salary.error) };
  }

  const account = onboardingAccountSchema.safeParse({
    accountName: formData.get("accountName"),
    accountType: formData.get("accountType"),
    accountBalance: formData.get("accountBalance"),
  });
  if (!account.success) {
    return { error: firstIssueMessage(account.error) };
  }

  const variableSpend = onboardingVariableSpendSchema.safeParse({
    variableSpendAmount: formData.get("variableSpendAmount"),
  });
  if (!variableSpend.success) {
    return { error: firstIssueMessage(variableSpend.error) };
  }

  const hasLoan = formData.get("hasLoan") === "on";
  let loan: ReturnType<typeof onboardingLoanSchema.parse> | null = null;
  if (hasLoan) {
    const parsedLoan = onboardingLoanSchema.safeParse({
      loanName: formData.get("loanName"),
      loanType: formData.get("loanType"),
      loanPrincipal: formData.get("loanPrincipal"),
      loanRate: formData.get("loanRate"),
      loanStartDate: formData.get("loanStartDate"),
      loanTenureMonths: formData.get("loanTenureMonths"),
      loanEmiAmount: formData.get("loanEmiAmount"),
      loanEmiDayOfMonth: formData.get("loanEmiDayOfMonth"),
      loanOutstanding: formData.get("loanOutstanding"),
      loanOutstandingAsOf: formData.get("loanOutstandingAsOf"),
    });
    if (!parsedLoan.success) {
      return { error: firstIssueMessage(parsedLoan.error) };
    }
    loan = parsedLoan.data;
  }

  const today = todayIst();
  const { year, month } = getIstParts(today);

  await updateUser(userId, { salaryDayOfMonth: salary.data.salaryDayOfMonth });

  await addCommitmentForUser(userId, {
    name: "Salary",
    direction: "INFLOW",
    category: "SALARY",
    amount: salary.data.salaryAmount,
    isVariable: false,
    frequency: "MONTHLY",
    anchorDate: resolveIstDateForDayOfMonth(year, month, salary.data.salaryDayOfMonth),
    dayOfMonth: salary.data.salaryDayOfMonth,
    endDate: undefined,
  });

  await addAccountForUser(userId, {
    name: account.data.accountName,
    type: account.data.accountType,
    currentBalance: account.data.accountBalance,
    isJoint: false,
    balanceAsOf: today,
  });

  if (loan) {
    await addLiabilityForUser(userId, {
      name: loan.loanName,
      type: loan.loanType,
      principalAmount: loan.loanPrincipal,
      annualInterestRatePercent: loan.loanRate,
      startDate: loan.loanStartDate,
      tenureMonths: loan.loanTenureMonths,
      emiAmount: loan.loanEmiAmount,
      emiDayOfMonth: loan.loanEmiDayOfMonth,
      outstandingPrincipal: loan.loanOutstanding,
      outstandingAsOf: loan.loanOutstandingAsOf,
      prepaymentPenaltyPercent: undefined,
      isTaxDeductible: false,
      isSelfOccupied: true,
      isJoint: false,
    });
  }

  await setVariableSpendBaselineForUser(userId, {
    monthlyAmount: variableSpend.data.variableSpendAmount,
  });

  redirect("/today");
}
