import { prisma } from "@/lib/prisma";
import type { Liability, Prisma } from "@/lib/generated/prisma/client";

export function createLiability(data: Prisma.LiabilityCreateInput): Promise<Liability> {
  return prisma.liability.create({ data });
}

export function findLiabilityById(id: string): Promise<Liability | null> {
  return prisma.liability.findUnique({ where: { id } });
}

export function findLiabilitiesByUserId(userId: string): Promise<Liability[]> {
  return prisma.liability.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export function updateLiability(id: string, data: Prisma.LiabilityUpdateInput): Promise<Liability> {
  return prisma.liability.update({ where: { id }, data });
}

export function deleteLiability(id: string): Promise<Liability> {
  return prisma.liability.delete({ where: { id } });
}
