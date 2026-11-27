import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import * as webpush from 'web-push';
import { NOTIFICATION_CREATED, NotificationCreatedEvent } from '@common/events/domain-events';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import {
  notificationPreferences,
  notifications,
  pushSubscriptions,
} from '@database/schema/notifications.schema';
import { KINDS, type NotificationRealm } from './notification-kinds';

export interface NotifyInput {
  realm: NotificationRealm;
  recipientIds: string[];
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  data?: Record<string, string>;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Stores notifications, delivers them live to open apps (through the
 * messaging gateway) and as web push to every device that allowed it.
 *
 * A kind the person has switched off is skipped entirely: no bell entry,
 * no push. Sending never throws into the caller; a notification is never
 * worth failing the action that caused it.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private pushReady = false;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:hello@howdichat.com';
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.pushReady = true;
    } else {
      this.logger.warn('VAPID keys are not set; push notifications are off');
    }
  }

  publicKey(): string | null {
    return this.pushReady ? (this.config.get<string>('VAPID_PUBLIC_KEY') ?? null) : null;
  }

  async notify(input: NotifyInput): Promise<void> {
    try {
      const recipients = [...new Set(input.recipientIds)].filter(Boolean);
      if (!recipients.length) return;

      const off = await this.db
        .select({ ownerId: notificationPreferences.ownerId })
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.realm, input.realm),
            eq(notificationPreferences.kind, input.kind),
            eq(notificationPreferences.enabled, false),
            inArray(notificationPreferences.ownerId, recipients),
          ),
        );
      const muted = new Set(off.map((row) => row.ownerId));
      const wanted = recipients.filter((id) => !muted.has(id));
      if (!wanted.length) return;

      const rows = await this.db
        .insert(notifications)
        .values(
          wanted.map((recipientId) => ({
            realm: input.realm,
            recipientId,
            kind: input.kind,
            title: input.title,
            body: input.body ?? null,
            link: input.link ?? null,
            data: input.data ?? null,
          })),
        )
        .returning();

      for (const row of rows) {
        this.events.emit(
          NOTIFICATION_CREATED,
          new NotificationCreatedEvent(input.realm, row.recipientId, {
            id: row.id,
            kind: row.kind,
            title: row.title,
            body: row.body,
            link: row.link,
            createdAt: row.createdAt,
          }),
        );
      }
      await this.push(input.realm, wanted, {
        title: input.title,
        body: input.body ?? '',
        link: input.link ?? '/',
        tag: input.data?.tag ?? input.kind,
      });
    } catch (error) {
      this.logger.error(
        `Notification "${input.kind}" failed`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Whether a notification about this thing already went out since a moment. */
  async sentSince(
    realm: NotificationRealm,
    kind: string,
    key: string,
    value: string,
    since: Date,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.realm, realm),
          eq(notifications.kind, kind),
          sql`${notifications.data} ->> ${key} = ${value}`,
          sql`${notifications.createdAt} >= ${since}`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  private async push(
    realm: NotificationRealm,
    ownerIds: string[],
    payload: { title: string; body: string; link: string; tag: string },
  ): Promise<void> {
    if (!this.pushReady) return;
    const subscriptions = await this.db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.realm, realm), inArray(pushSubscriptions.ownerId, ownerIds)));
    const message = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            message,
            { TTL: 60 * 60 * 24 },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // The browser threw the subscription away; so do we.
          if (status === 404 || status === 410) {
            await this.db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, subscription.id));
          } else {
            this.logger.warn(`Push to one device failed (${status ?? 'network'})`);
          }
        }
      }),
    );
  }

  // ── The bell ──────────────────────────────────────────────────

  async list(realm: NotificationRealm, ownerId: string, limit = 30) {
    const [rows, [unread]] = await Promise.all([
      this.db
        .select({
          id: notifications.id,
          kind: notifications.kind,
          title: notifications.title,
          body: notifications.body,
          link: notifications.link,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(and(eq(notifications.realm, realm), eq(notifications.recipientId, ownerId)))
        .orderBy(desc(notifications.createdAt))
        .limit(Math.min(Math.max(limit, 1), 100)),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.realm, realm),
            eq(notifications.recipientId, ownerId),
            isNull(notifications.readAt),
          ),
        ),
    ]);
    return { items: rows, unread: Number(unread?.value ?? 0) };
  }

  /** Marks one notification read, or all of them when no id is given. */
  async markRead(realm: NotificationRealm, ownerId: string, id?: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.realm, realm),
          eq(notifications.recipientId, ownerId),
          isNull(notifications.readAt),
          id ? eq(notifications.id, id) : undefined,
        ),
      );
  }

  /** Clears notifications older than 90 days. */
  async prune(): Promise<void> {
    await this.db
      .delete(notifications)
      .where(lt(notifications.createdAt, sql`now() - interval '90 days'`));
  }

  // ── Settings ─────────────────────────────────────────────────

  async preferences(realm: NotificationRealm, ownerId: string): Promise<Record<string, boolean>> {
    const rows = await this.db
      .select({ kind: notificationPreferences.kind, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(
        and(eq(notificationPreferences.realm, realm), eq(notificationPreferences.ownerId, ownerId)),
      );
    const saved = new Map(rows.map((row) => [row.kind, row.enabled]));
    return Object.fromEntries(KINDS[realm].map((kind) => [kind, saved.get(kind) ?? true]));
  }

  async setPreference(
    realm: NotificationRealm,
    ownerId: string,
    kind: string,
    enabled: boolean,
  ): Promise<Record<string, boolean>> {
    if (KINDS[realm].includes(kind)) {
      await this.db
        .insert(notificationPreferences)
        .values({ realm, ownerId, kind, enabled })
        .onConflictDoUpdate({
          target: [
            notificationPreferences.realm,
            notificationPreferences.ownerId,
            notificationPreferences.kind,
          ],
          set: { enabled, updatedAt: new Date() },
        });
    }
    return this.preferences(realm, ownerId);
  }

  async subscribe(
    realm: NotificationRealm,
    ownerId: string,
    subscription: PushSubscriptionInput,
    userAgent?: string,
  ): Promise<void> {
    // An endpoint belongs to one browser; whoever signs in there owns it now.
    await this.db
      .insert(pushSubscriptions)
      .values({
        realm,
        ownerId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 300) ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          realm,
          ownerId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
  }

  async unsubscribe(realm: NotificationRealm, ownerId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.realm, realm),
          eq(pushSubscriptions.ownerId, ownerId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      );
  }
}
