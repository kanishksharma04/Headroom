import {
  createLiability,
  deleteLiability,
  findLiabilitiesByUserId,
  findLiabilityById,
  updateLiability,
} from "@/lib/repositories/liability-repository";
import {
  createCommitment,
  findCommitmentByLinkedLiabilityId,
  updateCommitment,
} from "@/lib/repositories/commitment-repository";
import { NotFoundError } from "@/lib/services/account-service";
import { captureNetWorthSnapshotForUser } from "@/lib/services/networth-snapshot-service";
import { deriveEmiCommitmentFields } from "@/lib/engines/commitments";
import { generateAmortisationSchedule, type AmortisationSchedule } from "@/lib/engines/amortisation";
import type { LiabilityFormInput } from "@/lib/validation/liability";
import type { Liability } from "@/lib/generated/prisma/client";

export function listLiabilitiesForUser(userId: string): Promise<Liability[]> {
  return findLiabilitiesByUserId(userId);
}

/**
 * Creates or updates the Commitment record that mirrors a liability's EMI,
 * so it never has to be entered as a separate commitment. Called after
 * every liability create/update.
 */
async function syncEmiCommitment(userId: string, liability: Liability): Promise<void> {
  const fields = deriveEmiCommitmentFields({
    emiAmount: liability.emiAmount,
    emiDayOfMonth: liability.emiDayOfMonth,
    startDate: liability.startDate,
    tenureMonths: liability.tenureMonths,
  });

  const existing = await findCommitmentByLinkedLiabilityId(liability.id);

  if (existing) {
    await updateCommitment(existing.id, {
      name: `${liability.name} EMI`,
      amount: fields.amount,
      anchorDate: fields.anchorDate,
      dayOfMonth: fields.dayOfMonth,
      endDate: fields.endDate,
    });
    return;
  }

  await createCommitment({
    user: { connect: { id: userId } },
    linkedLiability: { connect: { id: liability.id } },
    name: `${liability.name} EMI`,
    direction: "OUTFLOW",
    category: "EMI",
    frequency: "MONTHLY",
    isVariable: false,
    isActive: true,
    amount: fields.amount,
    anchorDate: fields.anchorDate,
    dayOfMonth: fields.dayOfMonth,
    endDate: fields.endDate,
  });
}

export async function addLiabilityForUser(
  userId: string,
  input: LiabilityFormInput,
): Promise<Liability> {
  const liability = await createLiability({
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
    isJoint: input.isJoint,
  });
  await syncEmiCommitment(userId, liability);
  await captureNetWorthSnapshotForUser(userId, new Date());
  return liability;
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
  const liability = await updateLiability(liabilityId, {
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
    isJoint: input.isJoint,
  });
  await syncEmiCommitment(userId, liability);
  await captureNetWorthSnapshotForUser(userId, new Date());
  return liability;
}

export async function removeLiabilityForUser(userId: string, liabilityId: string): Promise<void> {
  await requireOwnedLiability(userId, liabilityId);
  // The linked EMI commitment cascades on delete — see the Liability
  // relation in prisma/schema.prisma.
  await deleteLiability(liabilityId);
  await captureNetWorthSnapshotForUser(userId, new Date());
}

/**
 * The full amortisation schedule from the loan's original sanctioned
 * principal and first instalment — not the remaining schedule from today's
 * outstanding balance. Recorded prepayments aren't factored in: there's no
 * way to log one anywhere in the app yet, so there's nothing to account
 * for in practice.
 */
export async function getAmortisationScheduleForLiability(
  userId: string,
  liabilityId: string,
): Promise<{ liability: Liability; schedule: AmortisationSchedule }> {
  const liability = await requireOwnedLiability(userId, liabilityId);
  const emiFields = deriveEmiCommitmentFields(liability);
  const schedule = generateAmortisationSchedule({
    principal: liability.principalAmount,
    annualRatePercent: liability.annualInterestRatePercent,
    tenureMonths: liability.tenureMonths,
    firstDueDate: emiFields.anchorDate,
  });
  return { liability, schedule };
}
