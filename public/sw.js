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
