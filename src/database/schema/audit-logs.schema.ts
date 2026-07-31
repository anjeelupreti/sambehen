import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
  integer,
} from 'drizzle-orm/pg-core';

/**
 * Immutable record of every state-changing action.
 *
 * A data-entry system's core risk is a wrong or disputed entry, so who
 * changed what, when, and from where has to be reconstructable. Rows are
 * append-only: no update or delete path is exposed anywhere in the API.
 *
 * `correlationId` ties an entry back to the request's log lines and to the
 * error envelope the client received.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    /** 'team' | 'customer' | 'system' (background jobs). */
    actorType: varchar('actor_type', { length: 16 }).notNull(),
    actorId: uuid('actor_id'),
    actorRole: varchar('actor_role', { length: 32 }),

    /** Domain verb, e.g. 'customer.password_reset', 'transaction.correction'. */
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }),
    entityId: uuid('entity_id'),

    /** State before and after. Null when not applicable (reads, exports). */
    before: jsonb('before'),
    after: jsonb('after'),
    /** Extra context: export filters, bulk counts, recipient totals. */
    metadata: jsonb('metadata'),

    method: varchar('method', { length: 10 }),
    path: text('path'),
    statusCode: integer('status_code'),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    correlationId: varchar('correlation_id', { length: 64 }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_actor').on(table.actorType, table.actorId),
    index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_created_at').on(table.createdAt),
    index('idx_audit_logs_correlation').on(table.correlationId),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
