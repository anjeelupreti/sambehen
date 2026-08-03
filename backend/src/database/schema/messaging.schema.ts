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
import { ConversationStatus, MessageSenderType } from '@common/constants/app.constants';
import { customers } from './customers.schema';
import { staffUsers } from './staff-users.schema';

/**
 * One thread per customer.
 *
 * Deliberately not per-topic: a customer has a single conversation with
 * the business, and which staff member happens to answer is an internal
 * detail. The customer sees one continuous thread.
 *
 * `lastMessageAt` and `messageCount` are denormalised so the inbox can
 * sort and display without touching the messages table, which is the
 * largest table in the system.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    /** Staff member currently handling it. Informational, not an access rule. */
    assignedStaffId: uuid('assigned_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),

    status: varchar('status', { length: 12 })
      .notNull()
      .default(ConversationStatus.OPEN)
      .$type<ConversationStatus>(),

    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    lastMessagePreview: varchar('last_message_preview', { length: 200 }),
    /** Drives the "awaiting reply" filter without scanning messages. */
    lastCustomerMessageAt: timestamp('last_customer_message_at', { withTimezone: true }),
    lastStaffMessageAt: timestamp('last_staff_message_at', { withTimezone: true }),

    messageCount: integer('message_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Exactly one thread per customer.
    uniqueIndex('uq_conversations_customer').on(table.customerId),

    index('idx_conversations_last_message').on(table.lastMessageAt),
    index('idx_conversations_status').on(table.status),
    index('idx_conversations_assigned').on(table.assignedStaffId),

    check('chk_conversations_status', sql`${table.status} IN ('open', 'closed', 'archived')`),
  ],
);

/**
 * A single message.
 *
 * Staff attribution is ALWAYS recorded — the business needs to know who
 * said what — but the customer-facing serializer omits it. Whether the
 * customer sees which staff member replied is a presentation decision,
 * not a storage one, so the data is kept either way.
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),

    senderType: varchar('sender_type', { length: 10 }).notNull().$type<MessageSenderType>(),
    /** Set when senderType is 'staff'. Internal attribution. */
    senderStaffId: uuid('sender_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),
    /** Set when senderType is 'customer'. */
    senderCustomerId: uuid('sender_customer_id').references(() => customers.id, {
      onDelete: 'cascade',
    }),

    body: text('body').notNull(),
    attachments: jsonb('attachments'),

    deliveredAt: timestamp('delivered_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Serves thread pagination, which is always newest-first per thread.
    index('idx_messages_conversation_created').on(table.conversationId, table.createdAt),
    index('idx_messages_sender_staff').on(table.senderStaffId),
    // Serves the "responses today" metric.
    index('idx_messages_created').on(table.createdAt),

    check('chk_messages_sender_type', sql`${table.senderType} IN ('customer', 'staff', 'system')`),
    // The sender column must match the declared type, or attribution
    // becomes ambiguous and the unread calculation breaks.
    check(
      'chk_messages_sender_consistency',
      sql`(${table.senderType} = 'customer' AND ${table.senderCustomerId} IS NOT NULL)
          OR (${table.senderType} = 'staff' AND ${table.senderStaffId} IS NOT NULL)
          OR ${table.senderType} = 'system'`,
    ),
  ],
);

/**
 * Per-staff read position within a conversation.
 *
 * Unread cannot be a column on the conversation, because a runner, their
 * manager and the master all see the same thread independently: a message
 * read by the runner is still unread for the master. Each viewer carries
 * their own marker.
 *
 * Customers need no equivalent: they have exactly one thread, so their
 * unread count is a single query rather than a stored position.
 */
export const conversationReadStates = pgTable(
  'conversation_read_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
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
    // One marker per staff member per conversation. Also the conflict
    // target for the read upsert, so it is load-bearing.
    uniqueIndex('uq_conversation_read_states').on(table.conversationId, table.staffId),
    index('idx_conversation_read_states_staff').on(table.staffId),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ConversationReadState = typeof conversationReadStates.$inferSelect;
