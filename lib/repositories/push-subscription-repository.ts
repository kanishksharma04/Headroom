import { prisma } from "@/lib/prisma";
import type { PushSubscription } from "@/lib/generated/prisma/client";

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };

/** Re-subscribing the same browser (same endpoint) updates its keys rather than creating a duplicate row. */
export function upsertPushSubscription(userId: string, keys: PushSubscriptionKeys): Promise<PushSubscription> {
  return prisma.pushSubscription.upsert({
    where: { endpoint: keys.endpoint },
    create: { user: { connect: { id: userId } }, ...keys },
    update: { p256dh: keys.p256dh, auth: keys.auth },
  });
}

export function findPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]> {
  return prisma.pushSubscription.findMany({ where: { userId } });
}

export function findPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | null> {
  return prisma.pushSubscription.findUnique({ where: { endpoint } });
}

export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}
