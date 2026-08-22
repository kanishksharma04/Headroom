import { afterAll, describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser, findUserById } from "@/lib/repositories/user-repository";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTotpForUser,
  verifyTwoFactorCode,
} from "@/lib/services/auth-service";

function codeFor(secret: string): string {
  return new OTPAuth.TOTP({
    issuer: "Headroom",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

describe("auth-service — two-factor authentication", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  async function makeUser() {
    const user = await createUser({
      email: `totp-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: await bcrypt.hash("correct-password", 4),
      name: "TOTP Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("begins enrolment with a stored, unconfirmed secret — 2FA stays off until confirmed", async () => {
    const user = await makeUser();
    const { secret, uri } = await beginTotpEnrollment(user.id);

    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(uri.startsWith("otpauth://totp/")).toBe(true);

    const fetched = await findUserById(user.id);
    expect(fetched!.totpSecret).toBe(secret);
    expect(fetched!.totpEnabled).toBe(false);
  });

  it("rejects confirmation with the wrong code, and leaves 2FA off", async () => {
    const user = await makeUser();
    await beginTotpEnrollment(user.id);

    const result = await confirmTotpEnrollment(user.id, "000000");
    expect(result).toBeNull();

    const fetched = await findUserById(user.id);
    expect(fetched!.totpEnabled).toBe(false);
  });

  it("confirms with the right code, turning on 2FA and issuing 8 backup codes", async () => {
    const user = await makeUser();
    const { secret } = await beginTotpEnrollment(user.id);

    const result = await confirmTotpEnrollment(user.id, codeFor(secret));
    expect(result).not.toBeNull();
    expect(result!.backupCodes).toHaveLength(8);

    const fetched = await findUserById(user.id);
    expect(fetched!.totpEnabled).toBe(true);
    expect(fetched!.totpBackupCodeHashes).toHaveLength(8);
    // Only hashes are stored — none of the returned plaintext codes appear as-is.
    for (const code of result!.backupCodes) {
      expect(fetched!.totpBackupCodeHashes).not.toContain(code);
    }
  });

  it("verifyTwoFactorCode accepts a correct TOTP code", async () => {
    const user = await makeUser();
    const { secret } = await beginTotpEnrollment(user.id);
    await confirmTotpEnrollment(user.id, codeFor(secret));

    const fetched = await findUserById(user.id);
    expect(await verifyTwoFactorCode(fetched!, codeFor(secret))).toBe(true);
  });

  it("verifyTwoFactorCode rejects an incorrect code", async () => {
    const user = await makeUser();
    const { secret } = await beginTotpEnrollment(user.id);
    await confirmTotpEnrollment(user.id, codeFor(secret));

    const fetched = await findUserById(user.id);
    expect(await verifyTwoFactorCode(fetched!, "000000")).toBe(false);
  });

  it("verifyTwoFactorCode accepts a backup code exactly once, then rejects it", async () => {
    const user = await makeUser();
    const { secret } = await beginTotpEnrollment(user.id);
    const { backupCodes } = (await confirmTotpEnrollment(user.id, codeFor(secret)))!;

    const fetched = await findUserById(user.id);
    const firstUse = await verifyTwoFactorCode(fetched!, backupCodes[0]);
    expect(firstUse).toBe(true);

    const afterUse = await findUserById(user.id);
    expect(afterUse!.totpBackupCodeHashes).toHaveLength(7);

    const secondUse = await verifyTwoFactorCode(afterUse!, backupCodes[0]);
    expect(secondUse).toBe(false);
  });

  it("disableTotpForUser requires the correct password, and clears every TOTP field on success", async () => {
    const user = await makeUser();
    const { secret } = await beginTotpEnrollment(user.id);
    await confirmTotpEnrollment(user.id, codeFor(secret));

    const wrongPassword = await disableTotpForUser(user.id, "not-the-password");
    expect(wrongPassword).toBe(false);
    expect((await findUserById(user.id))!.totpEnabled).toBe(true);

    const rightPassword = await disableTotpForUser(user.id, "correct-password");
    expect(rightPassword).toBe(true);

    const fetched = await findUserById(user.id);
    expect(fetched!.totpEnabled).toBe(false);
    expect(fetched!.totpSecret).toBeNull();
    expect(fetched!.totpBackupCodeHashes).toHaveLength(0);
  });
});
