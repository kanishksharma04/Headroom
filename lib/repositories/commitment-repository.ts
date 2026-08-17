import { prisma } from "@/lib/prisma";
import type { Commitment, Prisma } from "@/lib/generated/prisma/client";

export function createCommitment(data: Prisma.CommitmentCreateInput): Promise<Commitment> {
  return prisma.commitment.create({ data });
}

export function findCommitmentById(id: string): Promise<Commitment | null> {
  return prisma.commitment.findUnique({ where: { id } });
}

export function findCommitmentByLinkedLiabilityId(liabilityId: string): Promise<Commitment | null> {
  return prisma.commitment.findFirst({ where: { linkedLiabilityId: liabilityId } });
}

export function findCommitmentsByUserId(
  userId: string,
  options?: { activeOnly?: boolean },
): Promise<Commitment[]> {
  return prisma.commitment.findMany({
    where: { userId, ...(options?.activeOnly ? { isActive: true } : {}) },
    orderBy: { anchorDate: "asc" },
  });
}

export function updateCommitment(
  id: string,
  data: Prisma.CommitmentUpdateInput,
): Promise<Commitment> {
  return prisma.commitment.update({ where: { id }, data });
}

export function deleteCommitment(id: string): Promise<Commitment> {
  return prisma.commitment.delete({ where: { id } });
}
