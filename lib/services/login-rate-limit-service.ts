import {
  countRecentLoginAttempts,
  createLoginAttempt,
  deleteLoginAttemptsForEmail,
} from "@/lib/repositories/login-attempt-repository";
import type { LoginAttemptKind } from "@/lib/generated/prisma/client";

export class LoginRateLimitError extends Error {}

const WINDOW_MINUTES = 15;
const WINDOW_MS = WINDOW_MINUTES * 60 * 1000;

/** Typos happen; a password round tolerates more failures before locking. */
const MAX_ATTEMPTS: Record<LoginAttemptKind, number> = {
  CREDENTIALS: 10,
  /** Fewer legitimate retries expected, and this is the higher-value
   * target — a 2FA account has already leaked its password to get here. */
  TOTP: 5,
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Throws {@link LoginRateLimitError} once an email has too many recent
 * failed attempts of the given kind within a sliding window — checked
 * before the real credential/code comparison runs, so a locked-out email
 * costs neither a bcrypt compare nor a TOTP check.
 */
export async function assertLoginAttemptAllowed(email: string, kind: LoginAttemptKind): Promise<void> {
  const normalized = normalizeEmail(email);
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await countRecentLoginAttempts(normalized, kind, since);
  if (count >= MAX_ATTEMPTS[kind]) {
    throw new LoginRateLimitError(`Too many attempts for this email. Wait ${WINDOW_MINUTES} minutes and try again.`);
  }
}

export function recordFailedLoginAttempt(email: string, kind: LoginAttemptKind): Promise<{ id: string }> {
  return createLoginAttempt(normalizeEmail(email), kind);
}

/** Called on a successful sign-in — past failures shouldn't count against future legitimate access. */
export function clearLoginAttempts(email: string) {
  return deleteLoginAttemptsForEmail(normalizeEmail(email));
}
