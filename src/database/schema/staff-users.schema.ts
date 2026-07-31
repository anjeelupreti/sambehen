import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { StaffRole } from '@common/constants/app.constants';

/**
 * Business-side accounts: master, manager and runner.
 *
 * Hierarchy is a self-referencing parent link:
 *   master  -> parentId IS NULL
 *   manager -> parentId references a master
 *   runner  -> parentId references a manager
 *
 * ScopeService walks this link to decide what an actor may see. The chain
 * is deliberately shallow and fixed at three levels, so visibility can be
 * resolved with denormalised columns on `customers` rather than a
 * recursive CTE on every list query.
 */
export const staffUsers = pgTable(
  'staff_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    email: varchar('email', { length: 255 }).notNull(),
    username: varchar('username', { length: 100 }).notNull(),
    passwordHash: text('password_hash').notNull(),

    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    phone: varchar('phone', { length: 32 }),

    role: varchar('role', { length: 16 }).notNull().$type<StaffRole>(),

    /** Managing staff member. Null only for a master. */
    // AnyPgColumn breaks the circular type reference a self-referencing
    // foreign key would otherwise create.
    parentId: uuid('parent_id').references((): AnyPgColumn => staffUsers.id, {
      onDelete: 'restrict',
    }),

    isActive: boolean('is_active').notNull().default(true),
    /** Set when an account is created or its password is reset by someone else. */
    mustChangePassword: boolean('must_change_password').notNull().default(false),

    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdByStaffId: uuid('created_by_staff_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Partial unique indexes rather than plain UNIQUE: a soft-deleted
    // account must not permanently reserve its email or username.
    uniqueIndex('uq_staff_users_email')
      .on(table.email)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('uq_staff_users_username')
      .on(table.username)
      .where(sql`${table.deletedAt} IS NULL`),

    index('idx_staff_users_role').on(table.role),
    index('idx_staff_users_parent').on(table.parentId),
    index('idx_staff_users_active').on(table.isActive),

    // The hierarchy invariant is enforced by the database, not only by the
    // service layer: a master never has a parent, and a manager or runner
    // always does. A bug that orphaned a runner would silently widen or
    // erase its scope.
    check(
      'chk_staff_hierarchy',
      sql`(${table.role} = 'master' AND ${table.parentId} IS NULL)
          OR (${table.role} IN ('manager', 'runner') AND ${table.parentId} IS NOT NULL)`,
    ),
    check('chk_staff_role', sql`${table.role} IN ('master', 'manager', 'runner')`),
    check('chk_staff_not_own_parent', sql`${table.parentId} IS DISTINCT FROM ${table.id}`),
  ],
);

export type StaffUser = typeof staffUsers.$inferSelect;
export type NewStaffUser = typeof staffUsers.$inferInsert;
