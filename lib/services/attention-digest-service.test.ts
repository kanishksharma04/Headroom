import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { createAccount } from "@/lib/repositories/account-repository";
import { createCommitment } from "@/lib/repositories/commitment-repository";
import {
  sendAttentionDigestForAllUsers,
  sendAttentionDigestForUser,
} from "@/lib/services/attention-digest-service";
import { istDate } from "@/lib/dates";

describe("attention-digest-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  async function makeUser(name = "Digest Test") {
    const user = await createUser({
      email: `digest-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name,
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("sends nothing, and reports zero items, for a user with nothing flagged", async () => {
    const user = await makeUser();
    await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "500000",
      balanceAsOf: new Date(),
    });

    const result = await sendAttentionDigestForUser(user, istDate(2026, 0, 20));
    expect(result).toEqual({ userId: user.id, itemCount: 0, sent: false });
  });

  it("counts a projected shortfall as an attention item, and no-ops the send without RESEND_API_KEY configured", async () => {
    const user = await makeUser();
    await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "0",
      balanceAsOf: new Date(),
    });
    await createCommitment({
      user: { connect: { id: user.id } },
      name: "Rent",
      direction: "OUTFLOW",
      category: "RENT",
      amount: "20000",
      frequency: "MONTHLY",
      anchorDate: istDate(2026, 0, 20),
      isActive: true,
      isVariable: false,
    });

    const result = await sendAttentionDigestForUser(user, istDate(2026, 0, 20));
    expect(result.itemCount).toBeGreaterThan(0);
    // RESEND_API_KEY is intentionally unset in the test environment, so
    // sendEmail no-ops rather than throwing — the digest logic still runs
    // end to end and reports what it would have sent.
    expect(result.sent).toBe(false);
  });

  it("processes every user and returns one result per user", async () => {
    const userA = await makeUser("A");
    const userB = await makeUser("B");
    for (const user of [userA, userB]) {
      await createAccount({
        user: { connect: { id: user.id } },
        name: "Bank",
        type: "SAVINGS",
        currentBalance: "500000",
        balanceAsOf: new Date(),
      });
    }

    const results = await sendAttentionDigestForAllUsers(istDate(2026, 0, 20));
    expect(results.find((r) => r.userId === userA.id)).toBeDefined();
    expect(results.find((r) => r.userId === userB.id)).toBeDefined();
  });
});
