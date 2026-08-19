"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prepayVsInvestScenarioSchema, affordabilityCheckSchema } from "@/lib/validation/scenario";
import {
  removeScenarioForUser,
  requireOwnedLiabilityForScenario,
  saveScenarioForUser,
} from "@/lib/services/scenario-service";
import { findUserById } from "@/lib/repositories/user-repository";
import { findAccountsByUserId } from "@/lib/repositories/account-repository";
import { findCommitmentsByUserId } from "@/lib/repositories/commitment-repository";
import { findGoalsByUserId } from "@/lib/repositories/goal-repository";
import { deriveRemainingScheduleParams, prepayVsInvest, checkAffordability } from "@/lib/engines/decisions";

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

export async function saveScenarioAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = prepayVsInvestScenarioSchema.safeParse({
    name: formData.get("name"),
    liabilityId: formData.get("liabilityId"),
    lumpSum: formData.get("lumpSum"),
    prepaymentMode: formData.get("prepaymentMode"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const [liability, user] = await Promise.all([
    requireOwnedLiabilityForScenario(userId, parsed.data.liabilityId),
    findUserById(userId),
  ]);
  if (!user) {
    throw new Error("User not found.");
  }

  const { remainingTenureMonths, firstDueDate } = deriveRemainingScheduleParams(liability, new Date());
  const result = prepayVsInvest({
    liability: {
      outstandingPrincipal: liability.outstandingPrincipal,
      annualRatePercent: liability.annualInterestRatePercent,
      remainingTenureMonths,
      firstDueDate,
      prepaymentPenaltyPercent: liability.prepaymentPenaltyPercent ?? undefined,
      isSelfOccupied: liability.isSelfOccupied,
    },
    lumpSum: parsed.data.lumpSum,
    prepaymentMode: parsed.data.prepaymentMode,
    taxProfile: { regime: user.taxRegime, taxSlabPercent: user.taxSlabPercent },
  });

  await saveScenarioForUser(
    userId,
    parsed.data.name,
    {
      liabilityId: parsed.data.liabilityId,
      lumpSum: parsed.data.lumpSum,
      prepaymentMode: parsed.data.prepaymentMode,
    },
    {
      interestSaved: result.prepay.interestSaved.toFixed(2),
      monthsSaved: result.prepay.monthsSaved,
      netBenefit: result.prepay.netBenefit.toFixed(2),
      hurdleRatePercent: result.hurdleRatePercent.toFixed(4),
    },
  );

  revalidatePath("/decide");
  return {};
}

export async function deleteScenarioAction(scenarioId: string): Promise<void> {
  const userId = await requireUserId();
  await removeScenarioForUser(userId, scenarioId);
  revalidatePath("/decide");
}

export type AffordabilityResultView = {
  resultingHeadroom: string;
  commitmentsAtRisk: { id: string; name: string; date: string; amount: string }[];
  emergencyFundMonthsBefore: string;
  emergencyFundMonthsAfter: string;
  goalImpacts: {
    goalId: string;
    goalName: string;
    baselineMonthsToTarget: number | null;
    afterPurchaseMonthsToTarget: number | null;
    monthsDelayed: number;
  }[];
  assumptions: string[];
};

export type AffordabilityFormState = { error?: string; result?: AffordabilityResultView };

export async function checkAffordabilityAction(
  _prevState: AffordabilityFormState,
  formData: FormData,
): Promise<AffordabilityFormState> {
  const userId = await requireUserId();
  const parsed = affordabilityCheckSchema.safeParse({
    purchaseAmount: formData.get("purchaseAmount"),
    purchaseDate: formData.get("purchaseDate"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const [user, accounts, commitments, goals] = await Promise.all([
    findUserById(userId),
    findAccountsByUserId(userId),
    findCommitmentsByUserId(userId, { activeOnly: true }),
    findGoalsByUserId(userId),
  ]);
  if (!user) {
    throw new Error("User not found.");
  }

  const result = checkAffordability({
    now: new Date(),
    purchaseAmount: parsed.data.purchaseAmount,
    purchaseDate: parsed.data.purchaseDate,
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    commitments,
    emergencyFundTargetMonths: user.emergencyFundTargetMonths,
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      monthlyContribution: g.monthlyContribution,
      expectedAnnualReturnPercent: g.expectedAnnualReturnPercent,
    })),
  });

  return {
    result: {
      resultingHeadroom: result.resultingHeadroom.toFixed(2),
      commitmentsAtRisk: result.commitmentsAtRisk.map((c) => ({
        id: c.id,
        name: c.name,
        date: c.date.toISOString(),
        amount: c.amount.toFixed(2),
      })),
      emergencyFundMonthsBefore: result.emergencyFundMonthsBefore.toFixed(1),
      emergencyFundMonthsAfter: result.emergencyFundMonthsAfter.toFixed(1),
      goalImpacts: result.goalImpacts,
      assumptions: result.assumptions,
    },
  };
}
