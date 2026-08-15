import { prisma } from "@/lib/prisma";
import type { Prisma, Scenario } from "@/lib/generated/prisma/client";

export function createScenario(data: Prisma.ScenarioCreateInput): Promise<Scenario> {
  return prisma.scenario.create({ data });
}

export function findScenariosByUserId(userId: string): Promise<Scenario[]> {
  return prisma.scenario.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export function deleteScenario(id: string): Promise<Scenario> {
  return prisma.scenario.delete({ where: { id } });
}
