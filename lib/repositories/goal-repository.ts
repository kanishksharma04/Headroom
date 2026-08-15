import { prisma } from "@/lib/prisma";
import type { Goal, Prisma } from "@/lib/generated/prisma/client";

export function createGoal(data: Prisma.GoalCreateInput): Promise<Goal> {
  return prisma.goal.create({ data });
}

export function findGoalById(id: string): Promise<Goal | null> {
  return prisma.goal.findUnique({ where: { id } });
}

export function findGoalsByUserId(userId: string): Promise<Goal[]> {
  return prisma.goal.findMany({ where: { userId }, orderBy: { targetDate: "asc" } });
}

export function updateGoal(id: string, data: Prisma.GoalUpdateInput): Promise<Goal> {
  return prisma.goal.update({ where: { id }, data });
}

export function deleteGoal(id: string): Promise<Goal> {
  return prisma.goal.delete({ where: { id } });
}
