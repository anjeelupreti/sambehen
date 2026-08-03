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
import { CampaignStatus, RecipientStatus, EmailKind } from '@common/constants/app.constants';
import { customers } from './customers.schema';
import { staffUsers } from './staff-users.schema';

/**
 * An email campaign.
 *
 * `filterSnapshot` records the targeting rules exactly as they were when
 * the campaign was sent. Re-running the filter later would produce a
 * different audience as customers change, so "who did this go to" has to
 * be answerable from stored data rather than recomputed.
 */
export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    subject: varchar('subject', { length: 255 }).notNull(),
    bodyHtml: text('body_html'),
    bodyText: text('body_text').notNull(),

    status: varchar('status', { length: 12 })
      .notNull()
      .default(CampaignStatus.DRAFT)
      .$type<CampaignStatus>(),

    /**
     * Decides the layout, accent colour and whether an unsubscribe footer
     * appears. Stored per campaign because it changes what the message is
     * allowed to contain, not merely how it looks.
     */
    emailKind: varchar('email_kind', { length: 16 })
      .notNull()
      .default(EmailKind.PROMOTIONAL)
      .$type<EmailKind>(),

    /** The filter that selected the audience, kept verbatim. */
    filterSnapshot: jsonb('filter_snapshot'),

    recipientCount: integer('recipient_count').notNull().default(0),
    sentCount: integer('sent_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),

    /** Set to send later; the dispatcher picks it up once due. */
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    createdByStaffId: uuid('created_by_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_email_campaigns_status').on(table.status),
    index('idx_email_campaigns_scheduled').on(table.scheduledAt),
    index('idx_email_campaigns_creator').on(table.createdByStaffId),

    check(
      'chk_email_campaigns_kind',
      sql`${table.emailKind} IN ('promotional', 'informational', 'notification', 'transactional', 'alert')`,
    ),
    check(
      'chk_email_campaigns_status',
      sql`${table.status} IN ('draft', 'queued', 'sending', 'sent', 'partial', 'failed', 'cancelled')`,
    ),
  ],
);

/**
 * One row per recipient — and the send queue itself.
 *
 * Rather than pushing jobs into an external broker, the dispatcher claims
 * pending rows straight from this table with FOR UPDATE SKIP LOCKED. The
 * queue is therefore restart-safe, inspectable in plain SQL, and needs no
 * extra infrastructure; it also stays correct if a second instance is ever
 * added, since SKIP LOCKED prevents two workers claiming the same row.
 *
 * The email address is copied here rather than joined at send time: a
 * campaign must go to the address that was targeted, even if the customer
 * changes it midway through the send.
 */
export const emailCampaignRecipients = pgTable(
  'email_campaign_recipients',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    /** Snapshotted at send time, deliberately not joined. */
    email: varchar('email', { length: 255 }).notNull(),

    status: varchar('status', { length: 10 })
      .notNull()
      .default(RecipientStatus.PENDING)
      .$type<RecipientStatus>(),

    providerMessageId: varchar('provider_message_id', { length: 255 }),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),

    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A customer appears at most once per campaign, so a retry or a
    // duplicated filter cannot send the same person two copies.
    uniqueIndex('uq_email_recipients').on(table.campaignId, table.customerId),

    // Serves the dispatcher's claim query.
    index('idx_email_recipients_claim').on(table.status, table.campaignId),
    index('idx_email_recipients_customer').on(table.customerId),

    check(
      'chk_email_recipients_status',
      sql`${table.status} IN ('pending', 'sending', 'sent', 'failed', 'bounced')`,
    ),
  ],
);

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;
export type EmailCampaignRecipient = typeof emailCampaignRecipients.$inferSelect;
