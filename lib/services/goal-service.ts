import { evaluateGoal, type GoalProjection } from "@/lib/engines/goals";
import {
  createGoal,
  deleteGoal,
  findGoalById,
  findGoalsByUserId,
  updateGoal,
} from "@/lib/repositories/goal-repository";
import { NotFoundError } from "@/lib/services/account-service";
import type { GoalFormInput } from "@/lib/validation/goal";
import type { Goal } from "@/lib/generated/prisma/client";

export type GoalWithProjection = Goal & { projection: GoalProjection };

export function listGoalsForUser(userId: string): Promise<Goal[]> {
  return findGoalsByUserId(userId);
}

/** Fetches every goal for a user alongside its engine-computed projection, for the Goals screen. */
export async function getGoalsOverviewForUser(userId: string, now: Date): Promise<GoalWithProjection[]> {
  const goals = await findGoalsByUserId(userId);
  return goals.map((goal) => ({
    ...goal,
    projection: evaluateGoal(
      {
        currentAmount: goal.currentAmount,
        targetAmount: goal.targetAmount,
        monthlyContribution: goal.monthlyContribution,
        expectedAnnualReturnPercent: goal.expectedAnnualReturnPercent,
        inflationPercent: goal.inflationPercent,
        targetDate: goal.targetDate,
      },
      now,
    ),
  }));
}

export function addGoalForUser(userId: string, input: GoalFormInput): Promise<Goal> {
  return createGoal({
    user: { connect: { id: userId } },
    name: input.name,
    targetAmount: input.targetAmount,
    currentAmount: input.currentAmount,
    targetDate: input.targetDate,
    monthlyContribution: input.monthlyContribution,
    expectedAnnualReturnPercent: input.expectedAnnualReturnPercent,
    inflationPercent: input.inflationPercent,
  });
}

async function requireOwnedGoal(userId: string, goalId: string): Promise<Goal> {
  const goal = await findGoalById(goalId);
  if (!goal || goal.userId !== userId) {
    throw new NotFoundError("Goal");
  }
  return goal;
}

export async function editGoalForUser(
  userId: string,
  goalId: string,
  input: GoalFormInput,
): Promise<Goal> {
  await requireOwnedGoal(userId, goalId);
  return updateGoal(goalId, {
    name: input.name,
    targetAmount: input.targetAmount,
    currentAmount: input.currentAmount,
    targetDate: input.targetDate,
    monthlyContribution: input.monthlyContribution,
    expectedAnnualReturnPercent: input.expectedAnnualReturnPercent,
    inflationPercent: input.inflationPercent,
  });
}

export async function removeGoalForUser(userId: string, goalId: string): Promise<void> {
  await requireOwnedGoal(userId, goalId);
  await deleteGoal(goalId);
}
