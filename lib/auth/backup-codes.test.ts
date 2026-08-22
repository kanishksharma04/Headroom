import { describe, expect, it } from "vitest";
import { consumeBackupCode, generateBackupCodes, hashBackupCodes } from "@/lib/auth/backup-codes";

describe("generateBackupCodes", () => {
  it("generates 8 unique codes in XXXX-XXXX form", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });
});

describe("hashBackupCodes / consumeBackupCode", () => {
  it("hashes each code so the stored value never matches the plaintext", async () => {
    const codes = generateBackupCodes();
    const hashes = await hashBackupCodes(codes);
    expect(hashes).toHaveLength(codes.length);
    for (let i = 0; i < codes.length; i++) {
      expect(hashes[i]).not.toBe(codes[i]);
    }
  });

  it("accepts a correct code, case-insensitively, and removes it from the returned set", async () => {
    const codes = generateBackupCodes();
    const hashes = await hashBackupCodes(codes);

    const result = await consumeBackupCode(codes[3].toLowerCase(), hashes);

    expect(result).not.toBeNull();
    expect(result!.remainingHashes).toHaveLength(hashes.length - 1);
    expect(result!.remainingHashes).not.toContain(hashes[3]);
  });

  it("tolerates surrounding whitespace from a pasted code", async () => {
    const codes = generateBackupCodes();
    const hashes = await hashBackupCodes(codes);
    const result = await consumeBackupCode(`  ${codes[0]}  `, hashes);
    expect(result).not.toBeNull();
  });

  it("rejects a code that isn't in the set", async () => {
    const codes = generateBackupCodes();
    const hashes = await hashBackupCodes(codes);
    const result = await consumeBackupCode("ZZZZ-ZZZZ", hashes);
    expect(result).toBeNull();
  });

  it("a code already removed from the set no longer verifies against it", async () => {
    const codes = generateBackupCodes();
    const hashes = await hashBackupCodes(codes);
    const first = await consumeBackupCode(codes[0], hashes);
    const second = await consumeBackupCode(codes[0], first!.remainingHashes);
    expect(second).toBeNull();
  });
});
