// Deliberately does no caching. This app shows live financial data — the
// Headroom Number, account balances, net worth — and serving a stale
// figure from a cache while offline would be actively misleading, not
// helpful. This service worker exists only so the app satisfies PWA
// install criteria; every request still goes straight to the network.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// Push notifications are opt-in (see /security) and carry no financial
// figures of their own — just a count and a link back into the app, where
// the real (never-cached) numbers live. So unlike the rest of this file,
// showing one is safe regardless of how stale the service worker itself is.
self.addEventListener("push", (event) => {
  let payload = { title: "Headroom", body: "Something needs your attention.", url: "/today" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/today";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
