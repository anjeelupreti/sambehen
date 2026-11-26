import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { customers } from './customers.schema';
import { staffUsers } from './staff-users.schema';

/**
 * Labels staff put on players ("Regular", "Weekend crowd"). The master
 * owns the set so it stays the same across every store; any staff member
 * can put a label on a player they can see.
 *
 * Automatic labels (new, VIP, big spender, inactive) are not stored here:
 * they are worked out from the player's record when asked for, so they can
 * never go stale.
 */
export const customerLabels = pgTable(
  'customer_labels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 40 }).notNull(),
    /** One of a fixed palette (see LABEL_COLORS), not a free hex value. */
    color: varchar('color', { length: 16 }).notNull().default('blue'),
    createdByStaffId: uuid('created_by_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_customer_labels_name').on(sql`lower(${table.name})`)],
);

export const customerLabelAssignments = pgTable(
  'customer_label_assignments',
  {
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => customerLabels.id, { onDelete: 'cascade' }),
    assignedByStaffId: uuid('assigned_by_staff_id').references(() => staffUsers.id, {
      onDelete: 'set null',
    }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.customerId, table.labelId] }),
    index('idx_customer_label_assignments_label').on(table.labelId),
  ],
);

export type CustomerLabel = typeof customerLabels.$inferSelect;
