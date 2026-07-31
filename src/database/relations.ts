import { relations } from 'drizzle-orm';
import { staffUsers } from './schema/staff-users.schema';
import { customers } from './schema/customers.schema';

/**
 * Drizzle ORM relation definitions.
 *
 * Declared here rather than beside each table so that circular references
 * between schemas (staff -> customers -> transactions -> staff) resolve
 * cleanly at import time.
 */
export const staffUsersRelations = relations(staffUsers, ({ one, many }) => ({
  /** The managing staff member: a runner's manager, or a manager's master. */
  parent: one(staffUsers, {
    fields: [staffUsers.parentId],
    references: [staffUsers.id],
    relationName: 'staff_hierarchy',
  }),
  /** Direct reports: a master's managers, or a manager's runners. */
  subordinates: many(staffUsers, { relationName: 'staff_hierarchy' }),

  ownedCustomers: many(customers, { relationName: 'customer_owner' }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  /** Source of truth for ownership: a runner or a manager. */
  owner: one(staffUsers, {
    fields: [customers.ownerStaffId],
    references: [staffUsers.id],
    relationName: 'customer_owner',
  }),
  manager: one(staffUsers, {
    fields: [customers.managerId],
    references: [staffUsers.id],
    relationName: 'customer_manager',
  }),
  runner: one(staffUsers, {
    fields: [customers.runnerId],
    references: [staffUsers.id],
    relationName: 'customer_runner',
  }),
  referredBy: one(customers, {
    fields: [customers.referredByCustomerId],
    references: [customers.id],
    relationName: 'customer_referrer',
  }),
}));
