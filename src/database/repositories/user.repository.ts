import { Injectable, Inject } from '@nestjs/common';
import { eq, ilike, SQL, and } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database.provider';
import { BaseRepository } from './base.repository';
import { users, User } from '../schema/users.schema';
import { IPaginationOptions, IPaginatedResult } from '@common/interfaces/pagination.interface';

/**
 * User repository — extends BaseRepository with user-specific queries.
 */
@Injectable()
export class UserRepository extends BaseRepository<typeof users> {
  constructor(
    @Inject(DRIZZLE_PROVIDER)
    db: DrizzleDB,
  ) {
    super(db, users);
  }

  /**
   * Find user by email.
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  /**
   * Find user by username.
   */
  async findByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  /**
   * Find active users with pagination, search, and filtering.
   */
  async findActiveUsers(
    options: IPaginationOptions,
    role?: string,
  ): Promise<IPaginatedResult<User>> {
    const conditions: SQL[] = [eq(users.isActive, true)];

    if (role) {
      conditions.push(eq(users.role, role));
    }

    return this.findPaginated(options, conditions, users.email as unknown as SQL);
  }

  /**
   * Search users by email or username.
   */
  async searchUsers(query: string): Promise<User[]> {
    return this.db
      .select()
      .from(users)
      .where(and(eq(users.isActive, true), ilike(users.email, `%${query}%`)));
  }

  /**
   * Update last login timestamp.
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }
}
