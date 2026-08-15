import { prisma } from "@/lib/prisma";
import type { Account, Prisma } from "@/lib/generated/prisma/client";

export function createAccount(data: Prisma.AccountCreateInput): Promise<Account> {
  return prisma.account.create({ data });
}

export function findAccountById(id: string): Promise<Account | null> {
  return prisma.account.findUnique({ where: { id } });
}

export function findAccountsByUserId(userId: string): Promise<Account[]> {
  return prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export function updateAccount(id: string, data: Prisma.AccountUpdateInput): Promise<Account> {
  return prisma.account.update({ where: { id }, data });
}

export function deleteAccount(id: string): Promise<Account> {
  return prisma.account.delete({ where: { id } });
}
