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
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  ReferralRewardType,
  ReferralStatus,
  BonusDirection,
} from '@common/constants/app.constants';
import { customers } from './customers.schema';
import { staffUsers } from './staff-users.schema';

/**
 * Bonus rules, defined by a master.
 *
 * A program says how much a referral is worth and what the referee must do
 * to earn it. Codes are issued against a program, so changing a program's
 * payout affects future rewards without rewriting ones already paid — the
 * amount is copied onto the referral row when it is granted.
 */
export const referralPrograms = pgTable(
  'referral_programs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),

    rewardType: varchar('reward_type', { length: 12 })
      .notNull()
      .default(ReferralRewardType.FIXED)
      .$type<ReferralRewardType>(),

    /** Paid to the customer who shared the code. */
    referrerBonus: numeric('referrer_bonus', { precision: 18, scale: 2 }).notNull().default('0.00'),
    /** Paid to the customer who signed up through it. */
    refereeBonus: numeric('referee_bonus', { precision: 18, scale: 2 }).notNull().default('0.00'),

    /**
     * How much the referee must deposit before the reward is granted.
     * Zero pays out on signup alone.
     */
    minQualifyingDebit: numeric('min_qualifying_debit', { precision: 18, scale: 2 })
      .notNull()
      .default('0.00'),

    /** Cap on rewards one referrer can earn. Null means unlimited. */
    maxRewardsPerReferrer: integer('max_rewards_per_referrer'),

    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'),

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
    index('idx_referral_programs_active').on(table.isActive),
    index('idx_referral_programs_validity').on(table.validFrom, table.validTo),

    check('chk_referral_programs_type', sql`${table.rewardType} IN ('fixed', 'percentage')`),
    check('chk_referral_programs_referrer_bonus', sql`${table.referrerBonus} >= 0`),
    check('chk_referral_programs_referee_bonus', sql`${table.refereeBonus} >= 0`),
    check('chk_referral_programs_min_debit', sql`${table.minQualifyingDebit} >= 0`),
    check(
      'chk_referral_programs_validity',
      sql`${table.validTo} IS NULL OR ${table.validTo} >= ${table.validFrom}`,
    ),
    check(
      'chk_referral_programs_max_rewards',
      sql`${table.maxRewardsPerReferrer} IS NULL OR ${table.maxRewardsPerReferrer} > 0`,
    ),
  ],
);

/**
 * A code and link issued to one customer under one program.
 *
 * The master selects which customers are eligible, so a code is always
 * deliberately granted rather than self-generated.
 */
export const referralCodes = pgTable(
  'referral_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    programId: uuid('program_id')
      .notNull()
      .references(() => referralPrograms.id, { onDelete: 'restrict' }),

    /** Short human-typeable code. Unambiguous alphabet, no O/0 or I/1. */
    code: varchar('code', { length: 16 }).notNull(),
    /** Opaque slug for the shareable URL, distinct from the code. */
    linkSlug: varchar('link_slug', { length: 32 }).notNull(),

    isActive: boolean('is_active').notNull().default(true),
    usageCount: integer('usage_count').notNull().default(0),
    /** Cap on redemptions of this specific code. Null means unlimited. */
    maxUses: integer('max_uses'),

    expiresAt: timestamp('expires_at', { withTimezone: true }),

    assignedByStaffId: uuid('assigned_by_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('uq_referral_codes_code').on(table.code),
    uniqueIndex('uq_referral_codes_slug').on(table.linkSlug),
    // One code per customer per program: re-assigning should return the
    // existing code rather than minting a second one they could both share.
    uniqueIndex('uq_referral_codes_customer_program').on(table.customerId, table.programId),

    index('idx_referral_codes_customer').on(table.customerId),
    index('idx_referral_codes_program').on(table.programId),

    check('chk_referral_codes_usage', sql`${table.usageCount} >= 0`),
    check('chk_referral_codes_max_uses', sql`${table.maxUses} IS NULL OR ${table.maxUses} > 0`),
  ],
);

/**
 * One redemption of a referral code.
 *
 * Moves pending -> qualified -> rewarded as the referee meets the
 * program's deposit threshold. The reward amounts are copied here when
 * granted, so a later change to the program cannot rewrite what was
 * already paid.
 */
export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    codeId: uuid('code_id')
      .notNull()
      .references(() => referralCodes.id, { onDelete: 'restrict' }),
    programId: uuid('program_id')
      .notNull()
      .references(() => referralPrograms.id, { onDelete: 'restrict' }),

    referrerCustomerId: uuid('referrer_customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    refereeCustomerId: uuid('referee_customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),

    status: varchar('status', { length: 12 })
      .notNull()
      .default(ReferralStatus.PENDING)
      .$type<ReferralStatus>(),

    /** Copied from the program at the moment the reward is granted. */
    referrerReward: numeric('referrer_reward', { precision: 18, scale: 2 }),
    refereeReward: numeric('referee_reward', { precision: 18, scale: 2 }),

    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    rewardedAt: timestamp('rewarded_at', { withTimezone: true }),
    rejectedReason: varchar('rejected_reason', { length: 200 }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // A customer can only ever be referred once. This is the guard that
    // stops a referee being re-referred for a second payout.
    uniqueIndex('uq_referrals_referee').on(table.refereeCustomerId),

    index('idx_referrals_referrer').on(table.referrerCustomerId),
    index('idx_referrals_status').on(table.status),
    index('idx_referrals_program').on(table.programId),
    index('idx_referrals_code').on(table.codeId),

    check(
      'chk_referrals_status',
      sql`${table.status} IN ('pending', 'qualified', 'rewarded', 'rejected')`,
    ),
    // Self-referral would let a customer pay themselves twice over.
    check('chk_referrals_not_self', sql`${table.referrerCustomerId} <> ${table.refereeCustomerId}`),
  ],
);

/**
 * Bonus money, kept deliberately separate from `transactions`.
 *
 * Bonuses are promotional credit, not money the customer put in or took
 * out. Recording them as transactions would inflate totalSpent and
 * totalWithdrawn and distort every dashboard net figure and top-game
 * metric. They live here and accumulate in customers.bonusBalance.
 */
export const bonusLedger = pgTable(
  'bonus_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),

    /** Set for referral rewards. The unique index below makes payout idempotent. */
    referralId: uuid('referral_id').references(() => referrals.id, { onDelete: 'set null' }),

    direction: varchar('direction', { length: 8 }).notNull().$type<BonusDirection>(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),

    /** e.g. 'referral_referrer', 'referral_referee', 'manual_adjustment'. */
    reason: varchar('reason', { length: 64 }).notNull(),
    note: text('note'),

    createdByStaffId: uuid('created_by_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Idempotency for referral payouts: one credit per referral per side.
    // A retried or duplicated reward attempt conflicts instead of paying
    // twice.
    uniqueIndex('uq_bonus_ledger_referral_reason')
      .on(table.referralId, table.reason)
      .where(sql`${table.referralId} IS NOT NULL`),

    index('idx_bonus_ledger_customer').on(table.customerId),
    index('idx_bonus_ledger_created').on(table.createdAt),

    check('chk_bonus_ledger_direction', sql`${table.direction} IN ('credit', 'debit')`),
    check('chk_bonus_ledger_amount', sql`${table.amount} > 0`),
  ],
);

export type ReferralProgram = typeof referralPrograms.$inferSelect;
export type NewReferralProgram = typeof referralPrograms.$inferInsert;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type BonusLedgerEntry = typeof bonusLedger.$inferSelect;
