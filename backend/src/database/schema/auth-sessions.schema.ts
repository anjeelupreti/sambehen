import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { AuthRealm } from '@common/constants/app.constants';

/**
 * One row per issued refresh token, for both realms.
 *
 * Enables three things a stateless JWT cannot do on its own:
 *  - logout that actually invalidates a token
 *  - revoking every session when an account is deactivated or its
 *    password is reset by staff
 *  - refresh-token reuse detection: a rotated token is marked replaced,
 *    and presenting it again means it leaked, so the whole chain is
 *    revoked rather than silently issuing another token
 *
 * Only the SHA-256 digest is stored. A database leak must not hand out
 * usable refresh tokens.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    /** Which realm the subject belongs to; ids are unique per realm only. */
    subjectType: varchar('subject_type', { length: 16 }).notNull().$type<AuthRealm>(),
    subjectId: uuid('subject_id').notNull(),

    refreshTokenHash: varchar('refresh_token_hash', { length: 64 }).notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Reason string, e.g. 'logout', 'rotated', 'reuse_detected', 'account_disabled'. */
    revokedReason: varchar('revoked_reason', { length: 40 }),
    /** Session this one rotated into, so a reuse can be traced along the chain. */
    replacedBySessionId: uuid('replaced_by_session_id'),

    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),

    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_auth_sessions_token_hash').on(table.refreshTokenHash),
    index('idx_auth_sessions_subject').on(table.subjectType, table.subjectId),
    index('idx_auth_sessions_expires').on(table.expiresAt),
  ],
);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
