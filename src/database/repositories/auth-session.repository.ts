import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database.provider';
import { authSessions, AuthSession, NewAuthSession } from '../schema/auth-sessions.schema';
import { BaseRepository } from './base.repository';
import { AuthRealm } from '@common/constants/app.constants';

@Injectable()
export class AuthSessionRepository extends BaseRepository<typeof authSessions> {
  constructor(@Inject(DRIZZLE_PROVIDER) db: DrizzleDB) {
    super(db, authSessions);
  }

  async createSession(data: NewAuthSession): Promise<AuthSession> {
    return this.create(data);
  }

  /** Looks a session up by the digest of the presented refresh token. */
  async findByTokenHash(tokenHash: string): Promise<AuthSession | undefined> {
    const rows = await this.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.refreshTokenHash, tokenHash))
      .limit(1);
    return rows[0];
  }

  async findActiveById(id: string): Promise<AuthSession | undefined> {
    const rows = await this.db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)))
      .limit(1);
    return rows[0];
  }

  async revoke(id: string, reason: string, replacedBySessionId?: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date(), revokedReason: reason, replacedBySessionId })
      .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)));
  }

  /**
   * Revokes every live session for a subject.
   *
   * Called on logout-everywhere, on staff-initiated password reset, and
   * whenever an account is deactivated — a disabled account must not keep
   * a valid refresh token in circulation.
   */
  async revokeAllForSubject(
    subjectType: AuthRealm,
    subjectId: string,
    reason: string,
  ): Promise<number> {
    const rows = await this.db
      .update(authSessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(
        and(
          eq(authSessions.subjectType, subjectType),
          eq(authSessions.subjectId, subjectId),
          isNull(authSessions.revokedAt),
        ),
      )
      .returning({ id: authSessions.id });
    return rows.length;
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(authSessions.id, id));
  }

  /**
   * Deletes sessions that expired more than `graceDays` ago.
   *
   * Expired rows are kept briefly rather than immediately, so reuse
   * detection still works for a token presented just after expiry.
   */
  async purgeExpired(graceDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
    const rows = await this.db
      .delete(authSessions)
      .where(lt(authSessions.expiresAt, cutoff))
      .returning({ id: authSessions.id });
    return rows.length;
  }

  async countActiveForSubject(subjectType: AuthRealm, subjectId: string): Promise<number> {
    const rows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(authSessions)
      .where(
        and(
          eq(authSessions.subjectType, subjectType),
          eq(authSessions.subjectId, subjectId),
          isNull(authSessions.revokedAt),
        ),
      );
    return Number(rows[0]?.value ?? 0);
  }
}
