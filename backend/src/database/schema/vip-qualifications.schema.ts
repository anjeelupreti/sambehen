import { pgTable, uuid, timestamp, numeric, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { customers } from './customers.schema';
import { vipCriteria } from './vip-criteria.schema';

/**
 * Materialised record of who reached which VIP threshold.
 *
 * Qualification could be derived on demand by summing transactions inside
 * each criteria window, but that turns every VIP list, every spin-event
 * eligibility check and the customer's own status page into an aggregate
 * over the whole transaction table. Storing the result makes all of them
 * indexed lookups.
 *
 * The trade-off is that these rows can go stale, so they are recomputed
 * from three directions: on each new transaction for that one customer,
 * on any change to the criteria, and nightly for drift repair. Recompute
 * is a single set-based upsert, so a full rebuild is one statement.
 *
 * A row exists ONLY when the customer qualified. Absence means not a VIP
 * for that criteria — there is no `qualified` boolean to get out of sync.
 */
export const vipQualifications = pgTable(
  'vip_qualifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    criteriaId: uuid('criteria_id')
      .notNull()
      .references(() => vipCriteria.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),

    /** What the customer actually reached, for showing progress beyond the bar. */
    achievedAmount: numeric('achieved_amount', { precision: 18, scale: 2 }).notNull(),
    /** The threshold in force when this row was written, so history stays readable. */
    thresholdAmount: numeric('threshold_amount', { precision: 18, scale: 2 }).notNull(),

    qualifiedAt: timestamp('qualified_at', { withTimezone: true }).notNull().defaultNow(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One row per customer per criteria. This is also the conflict target
    // for the recompute upsert, so it is load-bearing, not just a guard.
    uniqueIndex('uq_vip_qualifications').on(table.criteriaId, table.customerId),

    index('idx_vip_qualifications_customer').on(table.customerId),
    index('idx_vip_qualifications_criteria').on(table.criteriaId),
    index('idx_vip_qualifications_qualified_at').on(table.qualifiedAt),
  ],
);

export type VipQualification = typeof vipQualifications.$inferSelect;
export type NewVipQualification = typeof vipQualifications.$inferInsert;
