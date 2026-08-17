import {
  createAccount,
  deleteAccount,
  findAccountById,
  findAccountsByUserId,
  updateAccount,
} from "@/lib/repositories/account-repository";
import type { AccountFormInput } from "@/lib/validation/account";
import type { Account } from "@/lib/generated/prisma/client";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found.`);
    this.name = "NotFoundError";
  }
}

export function listAccountsForUser(userId: string): Promise<Account[]> {
  return findAccountsByUserId(userId);
}

export function addAccountForUser(userId: string, input: AccountFormInput): Promise<Account> {
  return createAccount({
    user: { connect: { id: userId } },
    name: input.name,
    type: input.type,
    currentBalance: input.currentBalance,
    isJoint: input.isJoint,
    balanceAsOf: input.balanceAsOf,
  });
}

async function requireOwnedAccount(userId: string, accountId: string): Promise<Account> {
  const account = await findAccountById(accountId);
  if (!account || account.userId !== userId) {
    throw new NotFoundError("Account");
  }
  return account;
}

export async function editAccountForUser(
  userId: string,
  accountId: string,
  input: AccountFormInput,
): Promise<Account> {
  await requireOwnedAccount(userId, accountId);
  return updateAccount(accountId, {
    name: input.name,
    type: input.type,
    currentBalance: input.currentBalance,
    isJoint: input.isJoint,
    balanceAsOf: input.balanceAsOf,
  });
}

export async function removeAccountForUser(userId: string, accountId: string): Promise<void> {
  await requireOwnedAccount(userId, accountId);
  await deleteAccount(accountId);
}
