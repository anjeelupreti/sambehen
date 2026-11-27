import { sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { customers } from './customers.schema';
import { games } from './games.schema';
import { staffUsers } from './staff-users.schema';

/**
 * Big wins, entered by staff after a player wins on a game. They feed the
 * players' wins ticker and board, so every row is a real win someone
 * recorded; nothing here is generated.
 *
 * A hidden win stays on record for staff but leaves the feed.
 */
export const bigWins = pgTable(
  'big_wins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    wonAt: timestamp('won_at', { withTimezone: true }).notNull().defaultNow(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    recordedByStaffId: uuid('recorded_by_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_big_wins_won_at').on(table.wonAt),
    index('idx_big_wins_customer').on(table.customerId),
    check('chk_big_wins_amount', sql`${table.amount} > 0`),
  ],
);

export type BigWin = typeof bigWins.$inferSelect;
