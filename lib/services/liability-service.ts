import {
  createLiability,
  deleteLiability,
  findLiabilitiesByUserId,
  findLiabilityById,
  updateLiability,
} from "@/lib/repositories/liability-repository";
import { NotFoundError } from "@/lib/services/account-service";
import type { LiabilityFormInput } from "@/lib/validation/liability";
import type { Liability } from "@/lib/generated/prisma/client";

export function listLiabilitiesForUser(userId: string): Promise<Liability[]> {
  return findLiabilitiesByUserId(userId);
}

export function addLiabilityForUser(
  userId: string,
  input: LiabilityFormInput,
): Promise<Liability> {
  return createLiability({
    user: { connect: { id: userId } },
    name: input.name,
    type: input.type,
    principalAmount: input.principalAmount,
    annualInterestRatePercent: input.annualInterestRatePercent,
    startDate: input.startDate,
    tenureMonths: input.tenureMonths,
    emiAmount: input.emiAmount,
    emiDayOfMonth: input.emiDayOfMonth,
    outstandingPrincipal: input.outstandingPrincipal,
    outstandingAsOf: input.outstandingAsOf,
    prepaymentPenaltyPercent: input.prepaymentPenaltyPercent ?? null,
    isTaxDeductible: input.isTaxDeductible,
    isSelfOccupied: input.isSelfOccupied,
  });
}

async function requireOwnedLiability(userId: string, liabilityId: string): Promise<Liability> {
  const liability = await findLiabilityById(liabilityId);
  if (!liability || liability.userId !== userId) {
    throw new NotFoundError("Liability");
  }
  return liability;
}

export async function editLiabilityForUser(
  userId: string,
  liabilityId: string,
  input: LiabilityFormInput,
): Promise<Liability> {
  await requireOwnedLiability(userId, liabilityId);
  return updateLiability(liabilityId, {
    name: input.name,
    type: input.type,
    principalAmount: input.principalAmount,
    annualInterestRatePercent: input.annualInterestRatePercent,
    startDate: input.startDate,
    tenureMonths: input.tenureMonths,
    emiAmount: input.emiAmount,
    emiDayOfMonth: input.emiDayOfMonth,
    outstandingPrincipal: input.outstandingPrincipal,
    outstandingAsOf: input.outstandingAsOf,
    prepaymentPenaltyPercent: input.prepaymentPenaltyPercent ?? null,
    isTaxDeductible: input.isTaxDeductible,
    isSelfOccupied: input.isSelfOccupied,
  });
}

export async function removeLiabilityForUser(userId: string, liabilityId: string): Promise<void> {
  await requireOwnedLiability(userId, liabilityId);
  await deleteLiability(liabilityId);
}
