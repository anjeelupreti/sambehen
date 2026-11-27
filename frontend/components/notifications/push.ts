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

/** Why turning push on failed, in words the person can act on. */
export class PushError extends Error {}

function explain(error: unknown): PushError {
  const name = (error as { name?: string })?.name ?? '';
  const message = String((error as { message?: string })?.message ?? '').toLowerCase();
  const brave = 'brave' in navigator;
  if (brave) {
    return new PushError(
      'Brave blocks push by default. Turn on “Use Google services for push messaging” in Brave’s privacy settings, restart Brave, then try again.',
    );
  }
  if (name === 'AbortError' && message.includes('permission')) {
    return new PushError(
      'Private windows can’t get notifications. Open Howdi chat in a normal window.',
    );
  }
  if (name === 'AbortError' || name === 'NotAllowedError' || message.includes('push service')) {
    return new PushError(
      'This browser couldn’t reach its push service. Check that notifications are allowed for your browser in your device settings, then try again.',
    );
  }
  return new PushError(
    'Notifications couldn’t be turned on in this browser. Try again, or use another browser.',
  );
}

const sameKey = (subscription: PushSubscription, key: Uint8Array) => {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((value, i) => value === key[i]);
};

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), ms),
    ),
  ]);

/**
 * Asks the browser, subscribes, and tells the server. Returns the new
 * state, or throws a PushError saying what went wrong.
 */
export async function enablePush(realm: NotificationRealm): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  // Fetched alongside the permission prompt, so subscribing follows the tap
  // as closely as possible (Safari is strict about that).
  const keyPromise = loadPushKey(realm);
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';

  const key = await keyPromise;
  if (!key) throw new PushError('Notifications aren’t set up on the server yet.');
  const applicationServerKey = keyBytes(key);

  let subscription: PushSubscription;
  try {
    const ready = await withTimeout(registration(), 15_000);
    let existing = await ready.pushManager.getSubscription();
    // One left over from an older key can't be reused, and blocks a new one.
    if (existing && !sameKey(existing, applicationServerKey)) {
      await existing.unsubscribe();
      existing = null;
    }
    subscription =
      existing ??
      (await withTimeout(
        ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }),
        20_000,
      ));
  } catch (error) {
    console.error('Push subscription failed', error);
    throw explain(error);
  }

  const json = subscription.toJSON();
  const saved = await savePushSubscription(realm, {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  });
  if (!saved)
    throw new PushError('Your browser is ready, but saving this device failed. Try again.');
  return 'on';
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
