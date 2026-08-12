import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { staffUsers } from './staff-users.schema';

/**
 * One thread per staff pair, entirely separate from customer conversations.
 *
 * `staffAId`/`staffBId` are stored in a canonical order (lexically smaller
 * id first, enforced by the check constraint) rather than "initiator" and
 * "recipient" — either side may have started it, and a lookup for "the
 * thread between these two people" must work regardless of who is asking.
 * That is also what makes the unique index correct: without a canonical
 * order, (A, B) and (B, A) would be two different rows for the same pair.
 */
export const staffConversations = pgTable(
  'staff_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    staffAId: uuid('staff_a_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    staffBId: uuid('staff_b_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),

    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    lastMessagePreview: varchar('last_message_preview', { length: 200 }),
    messageCount: integer('message_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('uq_staff_conversations_pair').on(table.staffAId, table.staffBId),
    index('idx_staff_conversations_a').on(table.staffAId),
    index('idx_staff_conversations_b').on(table.staffBId),
    index('idx_staff_conversations_last_message').on(table.lastMessageAt),

    check(
      'chk_staff_conversations_canonical_order',
      sql`${table.staffAId}::text < ${table.staffBId}::text`,
    ),
  ],
);

export const staffMessages = pgTable(
  'staff_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => staffConversations.id, { onDelete: 'cascade' }),
    senderStaffId: uuid('sender_staff_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),

    body: text('body').notNull(),
    attachments: jsonb('attachments'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_staff_messages_conversation_created').on(table.conversationId, table.createdAt),
    index('idx_staff_messages_sender').on(table.senderStaffId),
  ],
);

/**
 * Per-viewer read position, same reasoning as `conversationReadStates`: the
 * two participants read independently, so a message the sender's own other
 * device has "seen" is unrelated to whether the recipient has.
 */
export const staffConversationReadStates = pgTable(
  'staff_conversation_read_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => staffConversations.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),

    lastReadMessageId: uuid('last_read_message_id'),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('uq_staff_conversation_read_states').on(table.conversationId, table.staffId),
    index('idx_staff_conversation_read_states_staff').on(table.staffId),
  ],
);

export type StaffConversation = typeof staffConversations.$inferSelect;
export type NewStaffConversation = typeof staffConversations.$inferInsert;
export type StaffMessage = typeof staffMessages.$inferSelect;
export type NewStaffMessage = typeof staffMessages.$inferInsert;
export type StaffConversationReadState = typeof staffConversationReadStates.$inferSelect;
