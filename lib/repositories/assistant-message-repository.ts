import { prisma } from "@/lib/prisma";
import type { AssistantMessage, AssistantMessageRole, Prisma } from "@/lib/generated/prisma/client";

export function createAssistantMessage(
  userId: string,
  role: AssistantMessageRole,
  content: string,
): Promise<AssistantMessage> {
  return prisma.assistantMessage.create({ data: { user: { connect: { id: userId } }, role, content } });
}

/** Full history in chronological order, for the /assistant page's display. */
export function findAssistantMessagesByUserId(userId: string): Promise<AssistantMessage[]> {
  return prisma.assistantMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

/** The most recent `limit` messages, in chronological order — what's replayed to Claude each turn, so a long-lived conversation's context doesn't grow unboundedly. */
export async function findRecentAssistantMessagesByUserId(
  userId: string,
  limit: number,
): Promise<AssistantMessage[]> {
  const recent = await prisma.assistantMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return recent.reverse();
}

/** Count of the user's own messages in `[since, before)` — the rate limiter's query. */
export function countUserMessagesSince(userId: string, since: Date, before: Date): Promise<number> {
  return prisma.assistantMessage.count({
    where: { userId, role: "USER", createdAt: { gte: since, lt: before } },
  });
}

export function deleteAssistantMessagesByUserId(userId: string): Promise<Prisma.BatchPayload> {
  return prisma.assistantMessage.deleteMany({ where: { userId } });
}
