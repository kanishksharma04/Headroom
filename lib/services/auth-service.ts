import bcrypt from "bcrypt";
import { createUser, findUserByEmail } from "@/lib/repositories/user-repository";
import type { SignUpInput } from "@/lib/validation/auth";
import type { User } from "@/lib/generated/prisma/client";

const BCRYPT_ROUNDS = 12;

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export async function registerUser(input: SignUpInput): Promise<User> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return createUser({
    email: input.email,
    passwordHash,
    name: input.name,
  });
}
