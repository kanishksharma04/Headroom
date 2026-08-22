import bcrypt from "bcrypt";
import { createUser, findUserByEmail, findUserById, updateUser } from "@/lib/repositories/user-repository";
import { generateTotpSecret, totpProvisioningUri, verifyTotpCode } from "@/lib/auth/totp";
import { consumeBackupCode, generateBackupCodes, hashBackupCodes } from "@/lib/auth/backup-codes";
import { NotFoundError } from "@/lib/services/account-service";
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

// ---------------------------------------------------------------------------
// Two-factor authentication (TOTP)
// ---------------------------------------------------------------------------

/**
 * Checks a sign-in's 6-digit TOTP code, falling back to a one-time backup
 * code. A matched backup code is consumed immediately — removed from the
 * stored set — so it can never be replayed.
 */
export async function verifyTwoFactorCode(user: User, code: string): Promise<boolean> {
  if (!user.totpSecret) {
    return false;
  }
  if (verifyTotpCode(user.totpSecret, code)) {
    return true;
  }

  const result = await consumeBackupCode(code, user.totpBackupCodeHashes);
  if (!result) {
    return false;
  }
  await updateUser(user.id, { totpBackupCodeHashes: result.remainingHashes });
  return true;
}

/**
 * Starts (or restarts) TOTP enrolment: generates a fresh secret and stores
 * it, but doesn't turn on two-factor sign-in yet — {@link confirmTotpEnrollment}
 * does that, once the user proves they've actually scanned it correctly.
 * Restarting simply overwrites the previous, never-confirmed secret.
 */
export async function beginTotpEnrollment(userId: string): Promise<{ secret: string; uri: string }> {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User");
  }

  const secret = generateTotpSecret();
  await updateUser(userId, { totpSecret: secret });
  return { secret, uri: totpProvisioningUri(secret, user.email) };
}

/**
 * Confirms enrolment by checking one code from the freshly-scanned
 * authenticator, then turns on two-factor sign-in and issues backup codes
 * — returned once, in plaintext, for the user to save; only their bcrypt
 * hashes are kept.
 */
export async function confirmTotpEnrollment(
  userId: string,
  code: string,
): Promise<{ backupCodes: string[] } | null> {
  const user = await findUserById(userId);
  if (!user || !user.totpSecret) {
    return null;
  }
  if (!verifyTotpCode(user.totpSecret, code)) {
    return null;
  }

  const backupCodes = generateBackupCodes();
  const totpBackupCodeHashes = await hashBackupCodes(backupCodes);
  await updateUser(userId, { totpEnabled: true, totpBackupCodeHashes });
  return { backupCodes };
}

/** Turns off two-factor sign-in, requiring the current password as proof this is really the account owner. */
export async function disableTotpForUser(userId: string, password: string): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user) {
    return false;
  }
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return false;
  }

  await updateUser(userId, { totpEnabled: false, totpSecret: null, totpBackupCodeHashes: [] });
  return true;
}
