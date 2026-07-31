/**
 * Schema barrel — every table definition is re-exported from here.
 * Consumed by drizzle.config.ts (migration generation) and
 * database.provider.ts (the typed DrizzleDB instance).
 */
export * from './audit-logs.schema';
export * from './staff-users.schema';
export * from './customers.schema';
export * from './auth-sessions.schema';
export * from './games.schema';
export * from './transactions.schema';
export * from './vip-criteria.schema';
export * from './vip-qualifications.schema';
