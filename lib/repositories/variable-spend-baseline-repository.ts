import { prisma } from "@/lib/prisma";
import type { Prisma, VariableSpendBaseline } from "@/lib/generated/prisma/client";

export function upsertVariableSpendBaseline(
  userId: string,
  data: Omit<Prisma.VariableSpendBaselineCreateInput, "user">,
): Promise<VariableSpendBaseline> {
  return prisma.variableSpendBaseline.upsert({
    where: { userId },
    create: { ...data, user: { connect: { id: userId } } },
    update: data,
  });
}

export function findVariableSpendBaselineByUserId(
  userId: string,
): Promise<VariableSpendBaseline | null> {
  return prisma.variableSpendBaseline.findUnique({ where: { userId } });
}
