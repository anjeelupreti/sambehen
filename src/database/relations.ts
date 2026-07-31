/**
 * Drizzle ORM relation definitions.
 *
 * Relations live here rather than beside each table so that circular
 * references between schemas (staff -> customers -> transactions -> staff)
 * resolve cleanly at import time.
 *
 * Populated from phase 1 onward, e.g.
 *
 *   export const customersRelations = relations(customers, ({ one, many }) => ({
 *     owner: one(staffUsers, {
 *       fields: [customers.ownerStaffId],
 *       references: [staffUsers.id],
 *     }),
 *     transactions: many(transactions),
 *   }));
 */
export {};
