import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { CustomerStatus } from '@common/constants/app.constants';
import { staffUsers } from './staff-users.schema';

/**
 * Customer (inhaler) accounts.
 *
 * Customers authenticate through their own realm but cannot modify their
 * own profile or credentials: every write is performed by the master, the
 * owning manager, or the owning store, and is audit-logged.
 *
 * Ownership is stored three ways on purpose:
 *   ownerStaffId - source of truth, points at a store OR a manager
 *   managerId    - denormalised ancestor manager
 *   storeId      - set only when the owner is a store
 *
 * The denormalised columns let ScopeService express visibility as a single
 * indexed equality predicate instead of a recursive join, which matters
 * because every list, metric and export in the system composes it.
 * CustomerAssignmentService is the only writer, and keeps them consistent
 * inside a transaction.
 *
 * All three are nullable to make room for one exception: a customer who
 * self-registered (`status = 'pending'`) has no owner yet — a master picks
 * one on approval, at which point the ownership CHECK below starts
 * requiring them again. A NULL managerId/storeId already excludes a row
 * from every manager and store's scope predicate for free, so a pending
 * signup is invisible to staff until a master's own unrestricted scope
 * assigns it somewhere.
 */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    email: varchar('email', { length: 255 }).notNull(),
    username: varchar('username', { length: 100 }).notNull(),
    passwordHash: text('password_hash').notNull(),

    fullName: varchar('full_name', { length: 200 }),
    phone: varchar('phone', { length: 32 }),
    city: varchar('city', { length: 120 }),
    state: varchar('state', { length: 120 }),
    country: varchar('country', { length: 120 }),

    /** NULL only while `status = 'pending'`; every other status requires it. */
    ownerStaffId: uuid('owner_staff_id').references(() => staffUsers.id, { onDelete: 'restrict' }),
    managerId: uuid('manager_id').references(() => staffUsers.id, { onDelete: 'restrict' }),
    storeId: uuid('store_id').references(() => staffUsers.id, { onDelete: 'restrict' }),

    status: varchar('status', { length: 16 })
      .notNull()
      .default(CustomerStatus.ACTIVE)
      .$type<CustomerStatus>(),

    // Money is numeric, never float. Serialised as strings in JSON so
    // JavaScript's float precision cannot corrupt a balance in transit.
    balance: numeric('balance', { precision: 18, scale: 2 }).notNull().default('0.00'),
    bonusBalance: numeric('bonus_balance', { precision: 18, scale: 2 }).notNull().default('0.00'),

    /** Referrer, set when the account was created through a referral link. */
    referredByCustomerId: uuid('referred_by_customer_id'),

    /** Drives the active/inactive filters and the email targeting quick filters. */
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),

    /** Excluded from every campaign once true. */
    emailOptOut: boolean('email_opt_out').notNull().default(false),
    notes: text('notes'),

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
    uniqueIndex('uq_customers_email')
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('uq_customers_username')
      .on(table.username)
      .where(sql`${table.deletedAt} IS NULL`),

    // The scope predicates. Every customer-derived list filters on one of
    // these, so they carry most of the read load in the system.
    index('idx_customers_manager').on(table.managerId),
    index('idx_customers_store').on(table.storeId),
    index('idx_customers_owner').on(table.ownerStaffId),

    index('idx_customers_status').on(table.status),
    index('idx_customers_city').on(table.city),
    index('idx_customers_last_activity').on(table.lastActivityAt),
    index('idx_customers_referred_by').on(table.referredByCustomerId),

    // The customer search box matches on all four with a leading-wildcard
    // ILIKE, which a btree can never use. Trigram GIN indexes let Postgres
    // use a bitmap scan instead of a sequential scan as the table grows.
    index('idx_customers_email_trgm').using('gin', table.email.op('gin_trgm_ops')),
    index('idx_customers_username_trgm').using('gin', table.username.op('gin_trgm_ops')),
    index('idx_customers_full_name_trgm').using('gin', table.fullName.op('gin_trgm_ops')),
    index('idx_customers_phone_trgm').using('gin', table.phone.op('gin_trgm_ops')),

    check(
      'chk_customers_status',
      sql`${table.status} IN ('pending', 'active', 'inactive', 'suspended', 'banned')`,
    ),
    // A store-owned customer must carry both ids; a manager-owned one
    // carries no store. A pending signup carries none of the three, since
    // nobody has claimed it yet — the two shapes are mutually exclusive,
    // never a customer with only some ownership columns set.
    // `a = b` is NULL, not FALSE, when both sides are NULL — a CHECK only
    // rejects an expression that evaluates to FALSE, so the non-pending
    // branch spells out IS NOT NULL explicitly rather than trusting the
    // equality to catch an all-null row on its own.
    check(
      'chk_customers_ownership',
      sql`(${table.status} = 'pending'
           AND ${table.ownerStaffId} IS NULL AND ${table.managerId} IS NULL AND ${table.storeId} IS NULL)
          OR (${table.status} != 'pending'
              AND ${table.ownerStaffId} IS NOT NULL AND ${table.managerId} IS NOT NULL
              AND ((${table.storeId} IS NULL AND ${table.ownerStaffId} = ${table.managerId})
                OR (${table.storeId} IS NOT NULL AND ${table.ownerStaffId} = ${table.storeId})))`,
    ),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
