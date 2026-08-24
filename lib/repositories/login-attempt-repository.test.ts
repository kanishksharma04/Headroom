import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  countRecentLoginAttempts,
  createLoginAttempt,
  deleteLoginAttemptsForEmail,
} from "@/lib/repositories/login-attempt-repository";

describe("login-attempt repository", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  function testEmail(label: string): string {
    return `login-attempt-repo-test-${label}-${Date.now()}-${Math.random()}@example.com`;
  }

  it("countRecentLoginAttempts respects the since bound and ignores other kinds", async () => {
    const email = testEmail("window");
    const since = new Date(Date.now() - 60_000);

    await prisma.loginAttempt.create({
      data: { email, kind: "CREDENTIALS", createdAt: new Date(Date.now() - 120_000) },
    });
    await createLoginAttempt(email, "CREDENTIALS");
    await createLoginAttempt(email, "TOTP");

    expect(await countRecentLoginAttempts(email, "CREDENTIALS", since)).toBe(1);
    expect(await countRecentLoginAttempts(email, "TOTP", since)).toBe(1);
  });

  it("deleteLoginAttemptsForEmail clears both kinds, and only for that email", async () => {
    const emailA = testEmail("a");
    const emailB = testEmail("b");
    const since = new Date(Date.now() - 60_000);

    await createLoginAttempt(emailA, "CREDENTIALS");
    await createLoginAttempt(emailA, "TOTP");
    await createLoginAttempt(emailB, "CREDENTIALS");

    await deleteLoginAttemptsForEmail(emailA);

    expect(await countRecentLoginAttempts(emailA, "CREDENTIALS", since)).toBe(0);
    expect(await countRecentLoginAttempts(emailA, "TOTP", since)).toBe(0);
    expect(await countRecentLoginAttempts(emailB, "CREDENTIALS", since)).toBe(1);
  });
});
