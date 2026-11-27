import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * In-app notifications, for staff and players alike. `realm` says which
 * kind of account the recipient id belongs to ('team' or 'customer'); the
 * two id spaces are separate tables, so there is no foreign key here.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    realm: varchar('realm', { length: 10 }).notNull(),
    recipientId: uuid('recipient_id').notNull(),
    kind: varchar('kind', { length: 40 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    body: text('body'),
    /** Where tapping the notification goes, as an app path. */
    link: varchar('link', { length: 300 }),
    /** Ids the notification is about, for de-duplication and future use. */
    data: jsonb('data').$type<Record<string, string>>(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_recipient').on(table.realm, table.recipientId, table.createdAt),
  ],
);

/** One row per browser or phone that has allowed push notifications. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    realm: varchar('realm', { length: 10 }).notNull(),
    ownerId: uuid('owner_id').notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_push_subscriptions_endpoint').on(table.endpoint),
    index('idx_push_subscriptions_owner').on(table.realm, table.ownerId),
  ],
);

/** Kinds someone has switched off. A kind with no row is on. */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    realm: varchar('realm', { length: 10 }).notNull(),
    ownerId: uuid('owner_id').notNull(),
    kind: varchar('kind', { length: 40 }).notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.realm, table.ownerId, table.kind] })],
);

export type NotificationRow = typeof notifications.$inferSelect;
