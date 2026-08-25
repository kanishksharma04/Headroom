"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  prepayVsInvestScenarioSchema,
  affordabilityCheckSchema,
  incomeChangeCheckSchema,
  refinanceCheckSchema,
  insuranceAdequacyCheckSchema,
} from "@/lib/validation/scenario";
import {
  removeScenarioForUser,
  requireOwnedLiabilityForScenario,
  saveScenarioForUser,
} from "@/lib/services/scenario-service";
import { findUserById } from "@/lib/repositories/user-repository";
import { findAccountsByUserId } from "@/lib/repositories/account-repository";
import { findAssetsByUserId } from "@/lib/repositories/asset-repository";
import { findLiabilitiesByUserId } from "@/lib/repositories/liability-repository";
import { findCommitmentsByUserId } from "@/lib/repositories/commitment-repository";
import { findGoalsByUserId } from "@/lib/repositories/goal-repository";
import { findVariableSpendBaselineByUserId } from "@/lib/repositories/variable-spend-baseline-repository";
import {
  deriveRemainingScheduleParams,
  prepayVsInvest,
  checkAffordability,
  incomeChangeImpact,
  jobLossRunway,
  compareRefinance,
  assessLifeInsuranceAdequacy,
} from "@/lib/engines/decisions";
import { evaluateGoal } from "@/lib/engines/goals";
import { sum } from "@/lib/money";

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

export type IncomeChangeResultView = {
  currentMonthlySalary: string;
  newMonthlySalary: string;
  monthlySalaryDelta: string;
  projectedEndBalanceBefore: string;
  projectedEndBalanceAfter: string;
  projectedEndBalanceDelta: string;
  assumptions: string[];
};

export type IncomeChangeFormState = { error?: string; result?: IncomeChangeResultView };

export async function checkIncomeChangeAction(
  _prevState: IncomeChangeFormState,
  formData: FormData,
): Promise<IncomeChangeFormState> {
  const userId = await requireUserId();
  const parsed = incomeChangeCheckSchema.safeParse({
    newMonthlySalary: formData.get("newMonthlySalary"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const [accounts, commitments] = await Promise.all([
    findAccountsByUserId(userId),
    findCommitmentsByUserId(userId, { activeOnly: true }),
  ]);

  let result;
  try {
    result = incomeChangeImpact({
      now: new Date(),
      accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
      commitments,
      newMonthlySalary: parsed.data.newMonthlySalary,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not compute this scenario." };
  }

  return {
    result: {
      currentMonthlySalary: result.currentMonthlySalary.toFixed(2),
      newMonthlySalary: result.newMonthlySalary.toFixed(2),
      monthlySalaryDelta: result.monthlySalaryDelta.toFixed(2),
      projectedEndBalanceBefore: result.projectionBefore.endBalance.toFixed(2),
      projectedEndBalanceAfter: result.projectionAfter.endBalance.toFixed(2),
      projectedEndBalanceDelta: result.projectedEndBalanceDelta.toFixed(2),
      assumptions: result.assumptions,
    },
  };
}

export type JobLossResultView = {
  startingBalance: string;
  monthlyBurn: string;
  runwayDays: number | null;
  depletionDate: string | null;
  emergencyFundCoverageMonths: string;
  meetsEmergencyFundTarget: boolean;
  assumptions: string[];
};

export type JobLossFormState = { error?: string; result?: JobLossResultView };

export async function checkJobLossRunwayAction(): Promise<JobLossFormState> {
  const userId = await requireUserId();

  const [user, accounts, commitments, variableSpend] = await Promise.all([
    findUserById(userId),
    findAccountsByUserId(userId),
    findCommitmentsByUserId(userId, { activeOnly: true }),
    findVariableSpendBaselineByUserId(userId),
  ]);
  if (!user) {
    throw new Error("User not found.");
  }

  const result = jobLossRunway({
    now: new Date(),
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    commitments,
    variableSpendBaseline: variableSpend ? { monthlyAmount: variableSpend.monthlyAmount } : null,
    emergencyFundTargetMonths: user.emergencyFundTargetMonths,
  });

  return {
    result: {
      startingBalance: result.startingBalance.toFixed(2),
      monthlyBurn: result.monthlyBurn.toFixed(2),
      runwayDays: result.runwayDays,
      depletionDate: result.depletionDate ? result.depletionDate.toISOString() : null,
      emergencyFundCoverageMonths: result.emergencyFundCoverageMonths.toFixed(1),
      meetsEmergencyFundTarget: result.meetsEmergencyFundTarget,
      assumptions: result.assumptions,
    },
  };
}

export type RefinanceResultView = {
  currentEmi: string;
  newEmi: string;
  emiDelta: string;
  currentTotalInterest: string;
  newTotalInterest: string;
  interestSaved: string;
  foreclosurePenalty: string;
  processingFee: string;
  switchingCosts: string;
  lostDeductionValue: string;
  netBenefit: string;
  breakEvenMonths: number | null;
  assumptions: string[];
};

export type RefinanceFormState = { error?: string; result?: RefinanceResultView };

export async function checkRefinanceAction(
  _prevState: RefinanceFormState,
  formData: FormData,
): Promise<RefinanceFormState> {
  const userId = await requireUserId();
  const parsed = refinanceCheckSchema.safeParse({
    liabilityId: formData.get("liabilityId"),
    newAnnualRatePercent: formData.get("newAnnualRatePercent"),
    newLoanProcessingFeePercent: formData.get("newLoanProcessingFeePercent"),
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
  const result = compareRefinance({
    liability: {
      outstandingPrincipal: liability.outstandingPrincipal,
      annualRatePercent: liability.annualInterestRatePercent,
      remainingTenureMonths,
      firstDueDate,
      prepaymentPenaltyPercent: liability.prepaymentPenaltyPercent ?? undefined,
      isSelfOccupied: liability.isSelfOccupied,
    },
    newAnnualRatePercent: parsed.data.newAnnualRatePercent,
    newLoanProcessingFeePercent: parsed.data.newLoanProcessingFeePercent,
    taxProfile: { regime: user.taxRegime, taxSlabPercent: user.taxSlabPercent },
  });

  return {
    result: {
      currentEmi: result.currentEmi.toFixed(2),
      newEmi: result.newEmi.toFixed(2),
      emiDelta: result.emiDelta.toFixed(2),
      currentTotalInterest: result.currentTotalInterest.toFixed(2),
      newTotalInterest: result.newTotalInterest.toFixed(2),
      interestSaved: result.interestSaved.toFixed(2),
      foreclosurePenalty: result.foreclosurePenalty.toFixed(2),
      processingFee: result.processingFee.toFixed(2),
      switchingCosts: result.switchingCosts.toFixed(2),
      lostDeductionValue: result.lostDeductionValue.toFixed(2),
      netBenefit: result.netBenefit.toFixed(2),
      breakEvenMonths: result.breakEvenMonths,
      assumptions: result.assumptions,
    },
  };
}

export type InsuranceAdequacyResultView = {
  currentMonthlyIncome: string;
  incomeReplacementValue: string;
  debtCoverage: string;
  goalCoverage: string;
  requiredCover: string;
  existingCoverage: string;
  totalAssets: string;
  availableResources: string;
  netPosition: string;
  assumptions: string[];
};

export type InsuranceAdequacyFormState = { error?: string; result?: InsuranceAdequacyResultView };

export async function checkInsuranceAdequacyAction(
  _prevState: InsuranceAdequacyFormState,
  formData: FormData,
): Promise<InsuranceAdequacyFormState> {
  const userId = await requireUserId();
  const parsed = insuranceAdequacyCheckSchema.safeParse({
    existingCoverage: formData.get("existingCoverage"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const [commitments, liabilities, assets, accounts, goals] = await Promise.all([
    findCommitmentsByUserId(userId, { activeOnly: true }),
    findLiabilitiesByUserId(userId),
    findAssetsByUserId(userId),
    findAccountsByUserId(userId),
    findGoalsByUserId(userId),
  ]);

  const now = new Date();
  const outstandingDebt = sum(liabilities.map((l) => l.outstandingPrincipal));
  const totalAssets = sum([
    ...accounts.map((a) => a.currentBalance),
    ...assets.map((a) => a.currentValue),
  ]);
  const goalShortfallTotal = sum(
    goals.map((g) => evaluateGoal(g, now).shortfallAtTargetDate),
  );

  let result;
  try {
    result = assessLifeInsuranceAdequacy({
      commitments,
      outstandingDebt,
      totalAssets,
      goalShortfallTotal,
      existingCoverage: parsed.data.existingCoverage,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not compute this." };
  }

  return {
    result: {
      currentMonthlyIncome: result.currentMonthlyIncome.toFixed(2),
      incomeReplacementValue: result.incomeReplacementValue.toFixed(2),
      debtCoverage: result.debtCoverage.toFixed(2),
      goalCoverage: result.goalCoverage.toFixed(2),
      requiredCover: result.requiredCover.toFixed(2),
      existingCoverage: result.existingCoverage.toFixed(2),
      totalAssets: result.totalAssets.toFixed(2),
      availableResources: result.availableResources.toFixed(2),
      netPosition: result.netPosition.toFixed(2),
      assumptions: result.assumptions,
    },
  };
}
