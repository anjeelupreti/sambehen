'use client';

import {
  loadPushKey,
  removePushSubscription,
  savePushSubscription,
  type NotificationRealm,
} from '@/lib/notification-actions';

/**
 * Web push on this device. A subscription belongs to the browser, so the
 * same helpers serve staff and players; the realm decides whose account
 * the server files it under.
 */

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** iPhone and iPad only allow push from an app added to the Home Screen. */
export function needsHomeScreen(): boolean {
  if (typeof window === 'undefined') return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (!existing) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const existing = await navigator.serviceWorker.getRegistration('/');
  const subscription = await existing?.pushManager.getSubscription();
  return subscription ? 'on' : 'off';
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Asks the browser, subscribes, and tells the server. Returns the new state. */
export async function enablePush(realm: NotificationRealm): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';

  const key = await loadPushKey(realm);
  if (!key) return 'off';
  const ready = await registration();
  let subscription = await ready.pushManager.getSubscription();
  if (!subscription) {
    subscription = await ready.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    });
  }
  const json = subscription.toJSON();
  const saved = await savePushSubscription(realm, {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  });
  return saved ? 'on' : 'off';
}

export async function disablePush(realm: NotificationRealm): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const existing = await navigator.serviceWorker.getRegistration('/');
  const subscription = await existing?.pushManager.getSubscription();
  if (subscription) {
    await removePushSubscription(realm, subscription.endpoint);
    await subscription.unsubscribe();
  }
  return 'off';
}

/** Re-files this browser's subscription under whoever is signed in now. */
export async function syncPush(realm: NotificationRealm): Promise<void> {
  if ((await pushState()) !== 'on') return;
  await enablePush(realm);
}
