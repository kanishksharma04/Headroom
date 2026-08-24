import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  assertLoginAttemptAllowed,
  clearLoginAttempts,
  LoginRateLimitError,
  recordFailedLoginAttempt,
} from "@/lib/services/login-rate-limit-service";

describe("login-rate-limit-service", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  function testEmail(label: string): string {
    return `login-rate-limit-test-${label}-${Date.now()}-${Math.random()}@example.com`;
  }

  it("allows attempts under the CREDENTIALS threshold, then rejects", async () => {
    const email = testEmail("credentials");
    for (let i = 0; i < 9; i++) {
      await expect(assertLoginAttemptAllowed(email, "CREDENTIALS")).resolves.toBeUndefined();
      await recordFailedLoginAttempt(email, "CREDENTIALS");
    }
    // 9 recorded failures — still under the cap of 10.
    await expect(assertLoginAttemptAllowed(email, "CREDENTIALS")).resolves.toBeUndefined();
    await recordFailedLoginAttempt(email, "CREDENTIALS");
    // 10th recorded failure — the next check should reject.
    await expect(assertLoginAttemptAllowed(email, "CREDENTIALS")).rejects.toBeInstanceOf(LoginRateLimitError);
  });

  it("locks out TOTP attempts at a stricter threshold than CREDENTIALS", async () => {
    const email = testEmail("totp");
    for (let i = 0; i < 5; i++) {
      await recordFailedLoginAttempt(email, "TOTP");
    }
    await expect(assertLoginAttemptAllowed(email, "TOTP")).rejects.toBeInstanceOf(LoginRateLimitError);
    // The CREDENTIALS bucket for the same email is untouched — kinds are independent.
    await expect(assertLoginAttemptAllowed(email, "CREDENTIALS")).resolves.toBeUndefined();
  });

  it("normalizes email case, so the limit can't be dodged with different casing", async () => {
    const email = testEmail("case");
    for (let i = 0; i < 10; i++) {
      await recordFailedLoginAttempt(email.toUpperCase(), "CREDENTIALS");
    }
    await expect(assertLoginAttemptAllowed(email.toLowerCase(), "CREDENTIALS")).rejects.toBeInstanceOf(
      LoginRateLimitError,
    );
  });

  it("clearLoginAttempts resets the count so a locked-out email can try again", async () => {
    const email = testEmail("clear");
    for (let i = 0; i < 10; i++) {
      await recordFailedLoginAttempt(email, "CREDENTIALS");
    }
    await expect(assertLoginAttemptAllowed(email, "CREDENTIALS")).rejects.toBeInstanceOf(LoginRateLimitError);

    await clearLoginAttempts(email);

    await expect(assertLoginAttemptAllowed(email, "CREDENTIALS")).resolves.toBeUndefined();
  });
});
