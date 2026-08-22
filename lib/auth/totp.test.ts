import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import { generateTotpSecret, totpProvisioningUri, verifyTotpCode } from "@/lib/auth/totp";

function codeAt(secret: string, timestamp: number): string {
  return new OTPAuth.TOTP({
    issuer: "Headroom",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate({ timestamp });
}

describe("generateTotpSecret", () => {
  it("generates a plausible base32 secret, different on each call", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]+=*$/);
    expect(a).not.toBe(b);
  });
});

describe("totpProvisioningUri", () => {
  it("produces an otpauth:// URI naming the issuer and the account", () => {
    const uri = totpProvisioningUri(generateTotpSecret(), "asha@example.com");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("Headroom");
    expect(uri).toContain(encodeURIComponent("asha@example.com"));
  });
});

describe("verifyTotpCode", () => {
  const secret = generateTotpSecret();
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);

  it("accepts the code generated for the current 30s step", () => {
    expect(verifyTotpCode(secret, codeAt(secret, now), { timestamp: now })).toBe(true);
  });

  it("accepts a code from one step earlier or later, for clock-drift tolerance", () => {
    expect(verifyTotpCode(secret, codeAt(secret, now - 30_000), { timestamp: now })).toBe(true);
    expect(verifyTotpCode(secret, codeAt(secret, now + 30_000), { timestamp: now })).toBe(true);
  });

  it("rejects a code from two steps away", () => {
    expect(verifyTotpCode(secret, codeAt(secret, now - 60_000), { timestamp: now })).toBe(false);
    expect(verifyTotpCode(secret, codeAt(secret, now + 60_000), { timestamp: now })).toBe(false);
  });

  it("rejects a code generated for a different secret", () => {
    const otherSecret = generateTotpSecret();
    expect(verifyTotpCode(secret, codeAt(otherSecret, now), { timestamp: now })).toBe(false);
  });

  it("rejects malformed input outright, without consulting the TOTP library", () => {
    expect(verifyTotpCode(secret, "12345", { timestamp: now })).toBe(false);
    expect(verifyTotpCode(secret, "abcdef", { timestamp: now })).toBe(false);
    expect(verifyTotpCode(secret, "", { timestamp: now })).toBe(false);
  });
});
