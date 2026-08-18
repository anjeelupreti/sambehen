import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, ne, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database.provider';
import { staffUsers, StaffUser } from '../schema/staff-users.schema';
import { BaseRepository } from './base.repository';
import { StaffRole } from '@common/constants/app.constants';

@Injectable()
export class StaffRepository extends BaseRepository<typeof staffUsers> {
  constructor(@Inject(DRIZZLE_PROVIDER) db: DrizzleDB) {
    super(db, staffUsers);
  }

  /** Columns free-text search is matched against. */
  get searchColumns(): PgColumn[] {
    return [staffUsers.email, staffUsers.username, staffUsers.firstName, staffUsers.lastName];
  }

  get sortableColumns(): Record<string, PgColumn> {
    return {
      email: staffUsers.email,
      username: staffUsers.username,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      lastLoginAt: staffUsers.lastLoginAt,
      createdAt: staffUsers.createdAt,
    };
  }

  /**
   * Looks up an account for login by email or username.
   *
   * Includes inactive accounts on purpose: the auth service must be able
   * to distinguish "wrong password" from "account disabled" and emit
   * AUTH_ACCOUNT_DISABLED, which it cannot do if the row is filtered out
   * here.
   */
  async findByIdentifier(identifier: string): Promise<StaffUser | undefined> {
    const normalised = identifier.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(staffUsers)
      .where(
        and(
          isNull(staffUsers.deletedAt),
          normalised.includes('@')
            ? eq(staffUsers.email, normalised)
            : eq(staffUsers.username, normalised),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findByEmail(email: string): Promise<StaffUser | undefined> {
    return this.findOneBy([eq(staffUsers.email, email.trim().toLowerCase())]);
  }

  async findByUsername(username: string): Promise<StaffUser | undefined> {
    return this.findOneBy([eq(staffUsers.username, username.trim().toLowerCase())]);
  }

  /** True when the email is taken by a different, non-deleted account. */
  async emailTaken(email: string, excludeId?: string): Promise<boolean> {
    const conditions: SQL[] = [eq(staffUsers.email, email.trim().toLowerCase())];
    if (excludeId) conditions.push(ne(staffUsers.id, excludeId));
    return this.exists(conditions);
  }

  async usernameTaken(username: string, excludeId?: string): Promise<boolean> {
    const conditions: SQL[] = [eq(staffUsers.username, username.trim().toLowerCase())];
    if (excludeId) conditions.push(ne(staffUsers.id, excludeId));
    return this.exists(conditions);
  }

  /** Direct reports of a staff member. */
  async findChildren(parentId: string, role?: StaffRole): Promise<StaffUser[]> {
    const conditions: SQL[] = [eq(staffUsers.parentId, parentId)];
    if (role) conditions.push(eq(staffUsers.role, role));
    return this.findAll(conditions);
  }

  /** Ids of a manager's stores, used to validate store filters. */
  async findChildIds(parentId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(and(eq(staffUsers.parentId, parentId), isNull(staffUsers.deletedAt)));
    return rows.map((row) => row.id);
  }

  async hasChildren(parentId: string): Promise<boolean> {
    return this.exists([eq(staffUsers.parentId, parentId)]);
  }

  async findMaster(): Promise<StaffUser | undefined> {
    return this.findOneBy([eq(staffUsers.role, StaffRole.MASTER)]);
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.db.update(staffUsers).set({ lastLoginAt: new Date() }).where(eq(staffUsers.id, id));
  }
}
