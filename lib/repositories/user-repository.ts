import { prisma } from "@/lib/prisma";
import type { Prisma, User } from "@/lib/generated/prisma/client";

export function createUser(data: Prisma.UserCreateInput): Promise<User> {
  return prisma.user.create({ data });
}

export function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findAllUsers(): Promise<User[]> {
  return prisma.user.findMany();
}

export function updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}

/**
 * Compare-and-swap update of a user's backup code hashes: only writes if
 * the stored array still matches `expectedHashes`. Returns false if another
 * request already changed it first, so a caller can re-read and retry
 * rather than silently clobbering a concurrent consumption.
 */
export async function updateBackupCodeHashesIfUnchanged(
  id: string,
  expectedHashes: string[],
  nextHashes: string[],
): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { id, totpBackupCodeHashes: { equals: expectedHashes } },
    data: { totpBackupCodeHashes: nextHashes },
  });
  return result.count === 1;
}

export function deleteUser(id: string): Promise<User> {
  return prisma.user.delete({ where: { id } });
}
