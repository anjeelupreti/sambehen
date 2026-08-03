import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { SpinSelectionMode, SpinEventStatus } from '@common/constants/app.constants';
import { vipCriteria } from './vip-criteria.schema';
import { customers } from './customers.schema';
import { staffUsers } from './staff-users.schema';

/**
 * A spin event, recorded as data entry rather than run as a game.
 *
 * Every event attaches to a VIP criteria and INHERITS its window: the
 * criteria decides both who may win and when the event is live. Keeping
 * the window on the criteria rather than duplicating it here means an
 * event can never disagree with the eligibility rule it was created under.
 *
 * Two selection modes:
 *   preselected — winners are chosen from qualified VIPs when the event is
 *                 created, and must be supplied then
 *   post_draw   — the draw happens elsewhere and winners are keyed in
 *                 afterwards
 */
export const spinEvents = pgTable(
  'spin_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),

    /** Decides eligibility AND the active window. Never nullable. */
    vipCriteriaId: uuid('vip_criteria_id')
      .notNull()
      .references(() => vipCriteria.id, { onDelete: 'restrict' }),

    selectionMode: varchar('selection_mode', { length: 16 }).notNull().$type<SpinSelectionMode>(),

    status: varchar('status', { length: 12 })
      .notNull()
      .default(SpinEventStatus.SCHEDULED)
      .$type<SpinEventStatus>(),

    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),

    prizeDescription: text('prize_description'),
    prizePool: numeric('prize_pool', { precision: 18, scale: 2 }),

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
    index('idx_spin_events_criteria').on(table.vipCriteriaId),
    index('idx_spin_events_status').on(table.status),
    index('idx_spin_events_scheduled').on(table.scheduledAt),

    check('chk_spin_events_mode', sql`${table.selectionMode} IN ('preselected', 'post_draw')`),
    check(
      'chk_spin_events_status',
      sql`${table.status} IN ('scheduled', 'live', 'completed', 'cancelled')`,
    ),
    check('chk_spin_events_prize_pool', sql`${table.prizePool} IS NULL OR ${table.prizePool} >= 0`),
  ],
);

/**
 * Winners of a spin event.
 *
 * Eligibility is checked against vip_qualifications for the event's
 * criteria at the moment of recording, so a winner is always someone who
 * genuinely met the threshold in that window.
 */
export const spinWinners = pgTable(
  'spin_winners',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    spinEventId: uuid('spin_event_id')
      .notNull()
      .references(() => spinEvents.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),

    prizeLabel: varchar('prize_label', { length: 200 }),
    prizeAmount: numeric('prize_amount', { precision: 18, scale: 2 }),

    /** 1 is first place. Used for ordering the announcement. */
    rank: integer('rank').notNull().default(1),

    /**
     * True when chosen at event creation, false when keyed in after the
     * draw. Kept so the audit trail shows how a winner was determined.
     */
    isPreselected: boolean('is_preselected').notNull().default(false),

    announcedAt: timestamp('announced_at', { withTimezone: true }),

    recordedByStaffId: uuid('recorded_by_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // One win per customer per event. The database refuses a duplicate
    // even if a concurrent request slips past the service check.
    uniqueIndex('uq_spin_winners').on(table.spinEventId, table.customerId),

    index('idx_spin_winners_customer').on(table.customerId),
    index('idx_spin_winners_event').on(table.spinEventId),
    // Serves the recent-winners feed.
    index('idx_spin_winners_announced').on(table.announcedAt),

    check('chk_spin_winners_rank', sql`${table.rank} >= 1`),
    check(
      'chk_spin_winners_prize_amount',
      sql`${table.prizeAmount} IS NULL OR ${table.prizeAmount} >= 0`,
    ),
  ],
);

export type SpinEvent = typeof spinEvents.$inferSelect;
export type NewSpinEvent = typeof spinEvents.$inferInsert;
export type SpinWinner = typeof spinWinners.$inferSelect;
export type NewSpinWinner = typeof spinWinners.$inferInsert;
