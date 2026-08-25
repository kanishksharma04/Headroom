"use client";

import { useEffect, useState, useTransition } from "react";
import { subscribeToPushAction, unsubscribeFromPushAction } from "@/app/(app)/security/actions";
import { Button } from "@/components/ui/button";

type Status = "checking" | "unsupported" | "off" | "on" | "denied";

/** Converts a URL-safe base64 VAPID public key into the Uint8Array pushManager.subscribe() expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function PushNotificationToggle({ publicKey }: { publicKey: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function detectStatus(): Promise<Status> {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return "unsupported";
      }
      if (Notification.permission === "denied") {
        return "denied";
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription ? "on" : "off";
    }

    detectStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleEnable() {
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus("denied");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // Uint8Array's type is generic over ArrayBufferLike (which
          // includes SharedArrayBuffer); this one is always a plain
          // ArrayBuffer, which is what BufferSource actually requires.
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
        const result = await subscribeToPushAction(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
        if (result.error) {
          setError(result.error);
          return;
        }
        setStatus("on");
      } catch {
        setError("Couldn't turn on notifications. Try again.");
      }
    });
  }

  function handleDisable() {
    setError(null);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await unsubscribeFromPushAction(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setStatus("off");
      } catch {
        setError("Couldn't turn off notifications. Try again.");
      }
    });
  }

  if (status === "checking") {
    return null;
  }

  if (status === "unsupported") {
    return <p className="text-muted-foreground text-sm">Not supported in this browser.</p>;
  }

  if (status === "denied") {
    return (
      <p className="text-muted-foreground text-sm">
        Notifications are blocked for this site — enable them in your browser&apos;s site settings to turn
        this on.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Get a push notification the moment something needs attention — a projected shortfall, an EMI that
        looks unpaid — instead of waiting for the daily email.
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div>
        {status === "on" ? (
          <Button type="button" variant="outline" onClick={handleDisable} disabled={isPending}>
            {isPending ? "Turning off…" : "Turn off notifications"}
          </Button>
        ) : (
          <Button type="button" onClick={handleEnable} disabled={isPending}>
            {isPending ? "Turning on…" : "Turn on notifications"}
          </Button>
        )}
      </div>
    </div>
  );
}
