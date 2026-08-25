import { listPushSubscriptionsForUser, unsubscribeFromPush } from "@/lib/services/push-subscription-service";
import { sendPushNotification } from "@/lib/push/send-push";

/**
 * Pushes to every device a user has subscribed, in parallel — each device
 * is independent, so one slow or dead endpoint shouldn't hold up the
 * others. A subscription the push service reports as expired (410/404) is
 * deleted immediately rather than retried on a future run. Returns the
 * count of devices that actually received it.
 */
export async function pushToAllDevices(userId: string, title: string, body: string, url: string): Promise<number> {
  const subscriptions = await listPushSubscriptionsForUser(userId);
  if (subscriptions.length === 0) {
    return 0;
  }

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      const result = await sendPushNotification(subscription, { title, body, url });
      if (result.expired) {
        await unsubscribeFromPush(subscription.endpoint);
      }
      return result.sent;
    }),
  );

  return results.filter(Boolean).length;
}
