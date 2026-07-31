import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  index,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { TransactionType, TransactionStatus } from '@common/constants/app.constants';
import { customers } from './customers.schema';
import { games } from './games.schema';
import { staffUsers } from './staff-users.schema';

/**
 * The data-entry core of the system.
 *
 * Semantics, which every downstream aggregate depends on:
 *
 *   DEBIT  — money IN from the customer (deposit / spend)
 *   CREDIT — money OUT to the customer
 *
 *   A CREDIT carrying `parentTransactionId` is a CORRECTION against an
 *   existing transaction, not a withdrawal. Entries are sometimes wrong,
 *   and rather than mutating history the fix is recorded as a credit
 *   linked to the original.
 *
 * Consequently:
 *   total_spent     = SUM(amount) WHERE type='debit'
 *   total_withdrawn = SUM(amount) WHERE type='credit'
 *                                   AND parent_transaction_id IS NULL
 *   net             = SUM(debit) - SUM(credit)
 *
 * Getting `total_withdrawn` wrong by counting corrections is the single
 * most likely way to misreport what a customer actually took out, which is
 * why the partial index below exists specifically for that query.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),

    type: varchar('type', { length: 8 }).notNull().$type<TransactionType>(),

    // numeric, never float: a rounding error here is money.
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),

    gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),

    /** Set only on corrections. Its presence is what excludes a credit from withdrawals. */
    parentTransactionId: uuid('parent_transaction_id').references(
      (): AnyPgColumn => transactions.id,
      { onDelete: 'restrict' },
    ),

    status: varchar('status', { length: 12 })
      .notNull()
      .default(TransactionStatus.COMPLETED)
      .$type<TransactionStatus>(),

    /** How the money moved: cash, bank, wallet, and so on. */
    channel: varchar('channel', { length: 50 }),
    referenceNo: varchar('reference_no', { length: 100 }),
    note: text('note'),

    /** When the money actually moved, which may differ from when it was keyed in. */
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),

    enteredByStaffId: uuid('entered_by_staff_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'restrict' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Per-customer history and the customer-list aggregates.
    index('idx_transactions_customer_occurred').on(table.customerId, table.occurredAt),
    // Dashboard time-bucketed series.
    index('idx_transactions_type_occurred').on(table.type, table.occurredAt),
    // Top-game aggregates.
    index('idx_transactions_game').on(table.gameId),
    index('idx_transactions_parent').on(table.parentTransactionId),
    index('idx_transactions_entered_by').on(table.enteredByStaffId),
    index('idx_transactions_status').on(table.status),

    // Serves the withdrawal aggregate specifically: credits that are not
    // corrections. Without it that query scans every credit and filters.
    index('idx_transactions_withdrawals')
      .on(table.customerId, table.amount)
      .where(sql`${table.type} = 'credit' AND ${table.parentTransactionId} IS NULL`),

    check('chk_transactions_amount_positive', sql`${table.amount} > 0`),
    check('chk_transactions_type', sql`${table.type} IN ('debit', 'credit')`),
    check('chk_transactions_status', sql`${table.status} IN ('pending', 'completed', 'reversed')`),
    // A correction is always a credit. A debit pointing at a parent would
    // silently inflate total_spent while looking like a fix.
    check(
      'chk_transactions_correction_is_credit',
      sql`${table.parentTransactionId} IS NULL OR ${table.type} = 'credit'`,
    ),
    check(
      'chk_transactions_not_own_parent',
      sql`${table.parentTransactionId} IS DISTINCT FROM ${table.id}`,
    ),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
