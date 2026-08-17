import {
  createCommitment,
  deleteCommitment,
  findCommitmentById,
  findCommitmentsByUserId,
  updateCommitment,
} from "@/lib/repositories/commitment-repository";
import { NotFoundError } from "@/lib/services/account-service";
import type { CommitmentFormInput } from "@/lib/validation/commitment";
import type { Commitment } from "@/lib/generated/prisma/client";

export function listCommitmentsForUser(
  userId: string,
  options?: { activeOnly?: boolean },
): Promise<Commitment[]> {
  return findCommitmentsByUserId(userId, options);
}

export function addCommitmentForUser(
  userId: string,
  input: CommitmentFormInput,
): Promise<Commitment> {
  return createCommitment({
    user: { connect: { id: userId } },
    name: input.name,
    direction: input.direction,
    category: input.category,
    amount: input.amount,
    isVariable: input.isVariable,
    frequency: input.frequency,
    anchorDate: input.anchorDate,
    dayOfMonth: input.dayOfMonth ?? null,
    endDate: input.endDate ?? null,
    isActive: true,
  });
}

async function requireOwnedCommitment(userId: string, commitmentId: string): Promise<Commitment> {
  const commitment = await findCommitmentById(commitmentId);
  if (!commitment || commitment.userId !== userId) {
    throw new NotFoundError("Commitment");
  }
  return commitment;
}

export async function editCommitmentForUser(
  userId: string,
  commitmentId: string,
  input: CommitmentFormInput,
): Promise<Commitment> {
  const existing = await requireOwnedCommitment(userId, commitmentId);
  if (existing.linkedLiabilityId) {
    throw new Error("This commitment is derived from a loan and can't be edited directly.");
  }
  return updateCommitment(commitmentId, {
    name: input.name,
    direction: input.direction,
    category: input.category,
    amount: input.amount,
    isVariable: input.isVariable,
    frequency: input.frequency,
    anchorDate: input.anchorDate,
    dayOfMonth: input.dayOfMonth ?? null,
    endDate: input.endDate ?? null,
  });
}

export async function removeCommitmentForUser(userId: string, commitmentId: string): Promise<void> {
  const existing = await requireOwnedCommitment(userId, commitmentId);
  if (existing.linkedLiabilityId) {
    throw new Error("This commitment is derived from a loan — delete the loan to remove it.");
  }
  await deleteCommitment(commitmentId);
}

export async function setCommitmentActiveForUser(
  userId: string,
  commitmentId: string,
  isActive: boolean,
): Promise<Commitment> {
  await requireOwnedCommitment(userId, commitmentId);
  return updateCommitment(commitmentId, { isActive });
}
