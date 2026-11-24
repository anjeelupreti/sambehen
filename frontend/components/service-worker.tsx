'use client';

import { useEffect } from 'react';

/** Registers the service worker in production, so the app can be installed and shows a page when offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installation is an extra; the site works the same without it.
    });
  }, []);
  return null;
}
