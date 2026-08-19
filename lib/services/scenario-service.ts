import {
  createScenario,
  deleteScenario,
  findScenariosByUserId,
} from "@/lib/repositories/scenario-repository";
import { findLiabilityById } from "@/lib/repositories/liability-repository";
import { NotFoundError } from "@/lib/services/account-service";
import type { Prisma, Scenario } from "@/lib/generated/prisma/client";

export function listScenariosForUser(userId: string): Promise<Scenario[]> {
  return findScenariosByUserId(userId);
}

export function saveScenarioForUser(
  userId: string,
  name: string,
  inputs: Prisma.InputJsonValue,
  result: Prisma.InputJsonValue,
): Promise<Scenario> {
  return createScenario({
    user: { connect: { id: userId } },
    name,
    type: "PREPAY_VS_INVEST",
    inputsJson: inputs,
    resultJson: result,
  });
}

export async function removeScenarioForUser(userId: string, scenarioId: string): Promise<void> {
  const scenarios = await findScenariosByUserId(userId);
  const owned = scenarios.find((s) => s.id === scenarioId);
  if (!owned) {
    throw new NotFoundError("Scenario");
  }
  await deleteScenario(scenarioId);
}

/** Confirms a liability belongs to the user before it's used in a scenario computation. */
export async function requireOwnedLiabilityForScenario(userId: string, liabilityId: string) {
  const liability = await findLiabilityById(liabilityId);
  if (!liability || liability.userId !== userId) {
    throw new NotFoundError("Liability");
  }
  return liability;
}
