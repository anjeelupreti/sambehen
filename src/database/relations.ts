import { relations } from 'drizzle-orm';
import { staffUsers } from './schema/staff-users.schema';
import { customers } from './schema/customers.schema';
import { games } from './schema/games.schema';
import { transactions } from './schema/transactions.schema';

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
  enteredTransactions: many(transactions),
}));

export const gamesRelations = relations(games, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  customer: one(customers, {
    fields: [transactions.customerId],
    references: [customers.id],
  }),
  game: one(games, {
    fields: [transactions.gameId],
    references: [games.id],
  }),
  enteredBy: one(staffUsers, {
    fields: [transactions.enteredByStaffId],
    references: [staffUsers.id],
  }),
  /** The transaction this one corrects, when it is a correction. */
  parent: one(transactions, {
    fields: [transactions.parentTransactionId],
    references: [transactions.id],
    relationName: 'transaction_corrections',
  }),
  /** Corrections issued against this transaction. */
  corrections: many(transactions, { relationName: 'transaction_corrections' }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  transactions: many(transactions),
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
