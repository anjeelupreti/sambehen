/**
 * Schema barrel — every table definition is re-exported from here.
 * Consumed by drizzle.config.ts (migration generation) and
 * database.provider.ts (the typed DrizzleDB instance).
 *
 * Phase 0 ships infrastructure tables only. The sample `users` table was
 * removed because this system needs two separate auth realms; phase 1
 * introduces `staff_users`, `customers` and `auth_sessions`.
 */
export * from './audit-logs.schema';
