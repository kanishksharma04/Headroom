import { prisma } from "@/lib/prisma";
import type { LoginAttemptKind, Prisma } from "@/lib/generated/prisma/client";

export function createLoginAttempt(email: string, kind: LoginAttemptKind): Promise<{ id: string }> {
  return prisma.loginAttempt.create({ data: { email, kind }, select: { id: true } });
}

export function countRecentLoginAttempts(email: string, kind: LoginAttemptKind, since: Date): Promise<number> {
  return prisma.loginAttempt.count({
    where: { email, kind, createdAt: { gte: since } },
  });
}

export function deleteLoginAttemptsForEmail(email: string): Promise<Prisma.BatchPayload> {
  return prisma.loginAttempt.deleteMany({ where: { email } });
}
