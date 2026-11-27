'use server';

import { apiGet, apiMutate } from '@/lib/api';
import type { components } from '@/lib/api-schema';
import { customerGet, customerMutate } from '@/lib/customer-api';

/**
 * Notifications for whoever is signed in. Staff and players use the same
 * actions; the realm picks the API prefix and the session cookie, and the
 * API only ever returns the caller's own notifications.
 */

export type NotificationRealm = 'staff' | 'customer';
export type AppNotification = components['schemas']['NotificationDto'];
export interface NotificationList {
  items: AppNotification[];
  unread: number;
}
export interface PushKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const base = (realm: NotificationRealm) =>
  realm === 'staff' ? '/team/notifications' : '/me/notifications';

const get = <T>(realm: NotificationRealm, path: string) =>
  realm === 'staff' ? apiGet<T>(`${base(realm)}${path}`) : customerGet<T>(`${base(realm)}${path}`);

const send = <T>(realm: NotificationRealm, path: string, method: 'POST' | 'PUT', body?: unknown) =>
  realm === 'staff'
    ? apiMutate<T>(`${base(realm)}${path}`, method, body)
    : customerMutate<T>(`${base(realm)}${path}`, method, body);

export async function loadNotifications(realm: NotificationRealm): Promise<NotificationList> {
  try {
    return await get<NotificationList>(realm, '');
  } catch {
    return { items: [], unread: 0 };
  }
}

/** One notification, or all of them when no id is given. */
export async function markNotificationsRead(realm: NotificationRealm, id?: string): Promise<void> {
  try {
    await send(realm, '/read', 'POST', id ? { id } : {});
  } catch {
    // The bell already shows it read; the next load corrects any drift.
  }
}

export async function loadPreferences(realm: NotificationRealm): Promise<Record<string, boolean>> {
  try {
    return await get<Record<string, boolean>>(realm, '/preferences');
  } catch {
    return {};
  }
}

export async function savePreference(
  realm: NotificationRealm,
  kind: string,
  enabled: boolean,
): Promise<Record<string, boolean> | null> {
  try {
    return await send<Record<string, boolean>>(realm, '/preferences', 'PUT', { kind, enabled });
  } catch {
    return null;
  }
}

/** The VAPID key a browser subscribes with; null when push is off on the server. */
export async function loadPushKey(realm: NotificationRealm): Promise<string | null> {
  try {
    return (await get<{ publicKey: string | null }>(realm, '/push')).publicKey;
  } catch {
    return null;
  }
}

export async function savePushSubscription(
  realm: NotificationRealm,
  subscription: PushKeys,
): Promise<boolean> {
  try {
    await send(realm, '/push/subscribe', 'POST', subscription);
    return true;
  } catch {
    return false;
  }
}

export async function removePushSubscription(
  realm: NotificationRealm,
  endpoint: string,
): Promise<void> {
  try {
    await send(realm, '/push/unsubscribe', 'POST', { endpoint });
  } catch {
    // The browser subscription is gone either way; a dead endpoint is pruned on its next push.
  }
}
