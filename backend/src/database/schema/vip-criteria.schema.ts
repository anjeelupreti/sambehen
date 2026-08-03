import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  integer,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { VipMetric } from '@common/constants/app.constants';

/**
 * VIP thresholds, defined by a master.
 *
 * Each criteria measures one metric over one date range and marks every
 * customer who reaches its threshold as a VIP for that window. Multiple
 * criteria coexist across different ranges and tiers, so "who was a VIP"
 * is always a question about a specific window rather than a permanent
 * label.
 *
 * A criteria is CURRENTLY ACTIVE when `isActive` and today falls inside
 * [periodStart, periodEnd]. Spin events attach to a criteria and inherit
 * that window, which is why the two concepts are not separated.
 *
 * `periodStart`/`periodEnd` are DATE, not timestamp: a VIP window is a
 * business decision expressed in whole days, and storing it as a timestamp
 * would make "is today inside the window" depend on the server's clock
 * time and timezone.
 */
export const vipCriteria = pgTable(
  'vip_criteria',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),

    /** Higher tier means more exclusive. Used for ordering and display. */
    tier: integer('tier').notNull().default(1),

    metric: varchar('metric', { length: 24 })
      .notNull()
      .default(VipMetric.TOTAL_DEBIT)
      .$type<VipMetric>(),

    /**
     * The value a customer must reach. Compared against money for
     * total_debit and net, and against a plain count for
     * transaction_count.
     */
    thresholdAmount: numeric('threshold_amount', { precision: 18, scale: 2 }).notNull(),

    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),

    isActive: boolean('is_active').notNull().default(true),

    createdByStaffId: uuid('created_by_staff_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_vip_criteria_active').on(table.isActive),
    index('idx_vip_criteria_period').on(table.periodStart, table.periodEnd),
    index('idx_vip_criteria_tier').on(table.tier),

    check('chk_vip_criteria_period', sql`${table.periodEnd} >= ${table.periodStart}`),
    check('chk_vip_criteria_threshold', sql`${table.thresholdAmount} > 0`),
    check(
      'chk_vip_criteria_metric',
      sql`${table.metric} IN ('total_debit', 'net', 'transaction_count')`,
    ),
    check('chk_vip_criteria_tier', sql`${table.tier} >= 1`),
  ],
);

export type VipCriteria = typeof vipCriteria.$inferSelect;
export type NewVipCriteria = typeof vipCriteria.$inferInsert;
