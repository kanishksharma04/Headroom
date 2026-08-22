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

export function deleteUser(id: string): Promise<User> {
  return prisma.user.delete({ where: { id } });
}
