import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Games that transactions are attributed to.
 *
 * Drives the dashboard's "top game by debit" and "top game by credit"
 * metrics, so a transaction's gameId is what makes those aggregates
 * possible. Kept deliberately thin — this system records play, it does
 * not run it.
 */
export const games = pgTable(
  'games',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 150 }).notNull(),
    /** Short stable identifier used in imports and exports. */
    code: varchar('code', { length: 50 }).notNull(),
    category: varchar('category', { length: 80 }),
    description: text('description'),
    imageUrl: varchar('image_url', { length: 2000 }),

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
    // Partial, so a soft-deleted game does not permanently reserve its code.
    uniqueIndex('uq_games_code')
      .on(table.code)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_games_active').on(table.isActive),
    index('idx_games_category').on(table.category),
  ],
);

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
