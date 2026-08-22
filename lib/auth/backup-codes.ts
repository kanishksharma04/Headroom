import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";

// Excludes 0/O and 1/I so a printed code is never ambiguous to read back.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_COUNT = 8;
const CODE_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

function randomCode(): string {
  const raw = Array.from(randomBytes(CODE_LENGTH), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Eight one-time recovery codes, shown to the user exactly once at TOTP enrolment. */
export function generateBackupCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, randomCode);
}

/** Bcrypt hashes of `codes`, in the same order — what actually gets stored. */
export function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code.toUpperCase(), BCRYPT_ROUNDS)));
}

/**
 * Checks `code` against a set of stored hashes and, if it matches one,
 * returns the remaining hashes with that one removed — each backup code
 * works exactly once. Returns null if `code` doesn't match any of them.
 */
export async function consumeBackupCode(
  code: string,
  hashes: string[],
): Promise<{ remainingHashes: string[] } | null> {
  const normalized = code.trim().toUpperCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      return { remainingHashes: [...hashes.slice(0, i), ...hashes.slice(i + 1)] };
    }
  }
  return null;
}
