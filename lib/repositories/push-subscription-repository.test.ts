import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import {
  deletePushSubscriptionByEndpoint,
  findPushSubscriptionByEndpoint,
  findPushSubscriptionsByUserId,
  upsertPushSubscription,
} from "@/lib/repositories/push-subscription-repository";

describe("push-subscription repository", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  async function makeUser() {
    const user = await createUser({
      email: `push-repo-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name: "Push Repo Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("upsertPushSubscription creates a new row for a new endpoint", async () => {
    const user = await makeUser();
    const endpoint = `https://push.example/${Date.now()}`;

    await upsertPushSubscription(user.id, { endpoint, p256dh: "key-1", auth: "auth-1" });

    const found = await findPushSubscriptionByEndpoint(endpoint);
    expect(found).toMatchObject({ userId: user.id, p256dh: "key-1", auth: "auth-1" });
  });

  it("upsertPushSubscription updates keys in place for an already-subscribed endpoint, not a duplicate row", async () => {
    const user = await makeUser();
    const endpoint = `https://push.example/${Date.now()}`;

    await upsertPushSubscription(user.id, { endpoint, p256dh: "key-old", auth: "auth-old" });
    await upsertPushSubscription(user.id, { endpoint, p256dh: "key-new", auth: "auth-new" });

    const subscriptions = await findPushSubscriptionsByUserId(user.id);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({ p256dh: "key-new", auth: "auth-new" });
  });

  it("findPushSubscriptionsByUserId only returns that user's rows", async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    await upsertPushSubscription(userA.id, { endpoint: `https://push.example/a-${Date.now()}`, p256dh: "k", auth: "a" });
    await upsertPushSubscription(userB.id, { endpoint: `https://push.example/b-${Date.now()}`, p256dh: "k", auth: "a" });

    const forA = await findPushSubscriptionsByUserId(userA.id);
    expect(forA).toHaveLength(1);
    expect(forA[0].userId).toBe(userA.id);
  });

  it("deletePushSubscriptionByEndpoint is idempotent — deleting a non-existent endpoint doesn't throw", async () => {
    await expect(deletePushSubscriptionByEndpoint("https://push.example/never-existed")).resolves.toBeUndefined();
  });

  it("deletePushSubscriptionByEndpoint removes exactly that subscription", async () => {
    const user = await makeUser();
    const endpoint = `https://push.example/${Date.now()}`;
    await upsertPushSubscription(user.id, { endpoint, p256dh: "k", auth: "a" });

    await deletePushSubscriptionByEndpoint(endpoint);

    expect(await findPushSubscriptionByEndpoint(endpoint)).toBeNull();
  });
});
