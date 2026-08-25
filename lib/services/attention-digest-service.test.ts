import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { createAccount } from "@/lib/repositories/account-repository";
import { createCommitment } from "@/lib/repositories/commitment-repository";
import { upsertPushSubscription } from "@/lib/repositories/push-subscription-repository";
import {
  sendAttentionDigestForAllUsers,
  sendAttentionDigestForUser,
} from "@/lib/services/attention-digest-service";
import { sendPushNotification } from "@/lib/push/send-push";
import { istDate } from "@/lib/dates";

vi.mock("@/lib/push/send-push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue({ sent: false, expired: false }),
}));

describe("attention-digest-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  afterEach(() => {
    vi.mocked(sendPushNotification).mockReset().mockResolvedValue({ sent: false, expired: false });
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
    expect(result).toEqual({ userId: user.id, itemCount: 0, sent: false, pushedDeviceCount: 0 });
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

  it("pushes to every subscribed device and counts only the successful ones", async () => {
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
    await upsertPushSubscription(user.id, { endpoint: "https://push.example/device-a", p256dh: "k", auth: "a" });
    await upsertPushSubscription(user.id, { endpoint: "https://push.example/device-b", p256dh: "k", auth: "a" });
    vi.mocked(sendPushNotification)
      .mockResolvedValueOnce({ sent: true, expired: false })
      .mockResolvedValueOnce({ sent: false, expired: false });

    const result = await sendAttentionDigestForUser(user, istDate(2026, 0, 20));

    expect(result.pushedDeviceCount).toBe(1);
    expect(sendPushNotification).toHaveBeenCalledTimes(2);
  });

  it("deletes a subscription the push service reports as expired, rather than retrying it later", async () => {
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
    await upsertPushSubscription(user.id, { endpoint: "https://push.example/dead-device", p256dh: "k", auth: "a" });
    vi.mocked(sendPushNotification).mockResolvedValueOnce({ sent: false, expired: true });

    await sendAttentionDigestForUser(user, istDate(2026, 0, 20));

    const remaining = await prisma.pushSubscription.findUnique({
      where: { endpoint: "https://push.example/dead-device" },
    });
    expect(remaining).toBeNull();
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
