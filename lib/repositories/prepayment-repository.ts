import { prisma } from "@/lib/prisma";
import type { Prepayment, Prisma } from "@/lib/generated/prisma/client";

export function createPrepayment(data: Prisma.PrepaymentCreateInput): Promise<Prepayment> {
  return prisma.prepayment.create({ data });
}

export function findPrepaymentsByLiabilityId(liabilityId: string): Promise<Prepayment[]> {
  return prisma.prepayment.findMany({ where: { liabilityId }, orderBy: { date: "asc" } });
}

export function deletePrepayment(id: string): Promise<Prepayment> {
  return prisma.prepayment.delete({ where: { id } });
}
