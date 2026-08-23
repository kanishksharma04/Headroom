"use client";

import { useEffect } from "react";

/**
 * Registers the no-op service worker (public/sw.js) purely so the app
 * satisfies PWA install criteria — it deliberately caches nothing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have, not a hard requirement — a
        // failed registration shouldn't surface as an app error.
      });
    }
  }, []);

  return null;
}
