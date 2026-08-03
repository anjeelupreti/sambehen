import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, ne, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database.provider';
import { customers, Customer } from '../schema/customers.schema';
import { BaseRepository } from './base.repository';

@Injectable()
export class CustomerRepository extends BaseRepository<typeof customers> {
  constructor(@Inject(DRIZZLE_PROVIDER) db: DrizzleDB) {
    super(db, customers);
  }

  get searchColumns(): PgColumn[] {
    return [customers.email, customers.username, customers.fullName, customers.phone];
  }

  get sortableColumns(): Record<string, PgColumn> {
    return {
      email: customers.email,
      username: customers.username,
      fullName: customers.fullName,
      status: customers.status,
      city: customers.city,
      balance: customers.balance,
      lastActivityAt: customers.lastActivityAt,
      registeredAt: customers.registeredAt,
      createdAt: customers.createdAt,
    };
  }

  /**
   * Looks up a customer for login by email or username.
   *
   * Includes non-active accounts so the auth service can report
   * AUTH_ACCOUNT_DISABLED rather than generic invalid credentials.
   */
  async findByIdentifier(identifier: string): Promise<Customer | undefined> {
    const normalised = identifier.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(customers)
      .where(
        and(
          isNull(customers.deletedAt),
          normalised.includes('@')
            ? eq(customers.email, normalised)
            : eq(customers.username, normalised),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async emailTaken(email: string, excludeId?: string): Promise<boolean> {
    const conditions: SQL[] = [eq(customers.email, email.trim().toLowerCase())];
    if (excludeId) conditions.push(ne(customers.id, excludeId));
    return this.exists(conditions);
  }

  async usernameTaken(username: string, excludeId?: string): Promise<boolean> {
    const conditions: SQL[] = [eq(customers.username, username.trim().toLowerCase())];
    if (excludeId) conditions.push(ne(customers.id, excludeId));
    return this.exists(conditions);
  }

  /**
   * Finds a customer only if it satisfies the caller's scope predicate.
   *
   * The predicate comes from ScopeService, so a record belonging to
   * another chain simply is not found — the caller then raises 404 rather
   * than 403, and the API never confirms that the record exists.
   */
  async findByIdScoped(id: string, scope: SQL | undefined): Promise<Customer | undefined> {
    return this.findOneBy(scope ? [eq(customers.id, id), scope] : [eq(customers.id, id)]);
  }

  /** True when any of these ids is owned by the given staff member. */
  async countOwnedBy(staffId: string): Promise<number> {
    return this.count([eq(customers.ownerStaffId, staffId)]);
  }

  async touchLastLogin(id: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(customers)
      .set({ lastLoginAt: now, lastActivityAt: now })
      .where(eq(customers.id, id));
  }
}
