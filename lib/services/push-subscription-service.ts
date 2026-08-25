import {
  deletePushSubscriptionByEndpoint,
  findPushSubscriptionsByUserId,
  upsertPushSubscription,
  type PushSubscriptionKeys,
} from "@/lib/repositories/push-subscription-repository";

export function subscribeUserToPush(userId: string, keys: PushSubscriptionKeys) {
  return upsertPushSubscription(userId, keys);
}

export function unsubscribeFromPush(endpoint: string): Promise<void> {
  return deletePushSubscriptionByEndpoint(endpoint);
}

export function listPushSubscriptionsForUser(userId: string) {
  return findPushSubscriptionsByUserId(userId);
}
