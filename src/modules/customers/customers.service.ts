import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gte, inArray, isNull, sql, SQL, count, sum } from 'drizzle-orm';
import { AuthRealm, CustomerStatus, SortOrder, StaffRole } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { HashUtil } from '@common/utils/hash.util';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { CustomerRepository } from '@database/repositories/customer.repository';
import {
  TransactionRepository,
  ICustomerTotals,
} from '@database/repositories/transaction.repository';
import { AuthSessionRepository } from '@database/repositories/auth-session.repository';
import { customers, Customer } from '@database/schema/customers.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { ScopeService } from '@shared/scope/scope.service';
import { AuditService } from '@shared/audit/audit.service';
import { CustomerAssignmentService } from '@modules/staff/customer-assignment.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  SetCustomerPasswordDto,
  ChangeCustomerStatusDto,
  ReassignCustomerDto,
  CustomerFilterDto,
  CustomerResponseDto,
  CustomerListSummaryDto,
} from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly customerRepository: CustomerRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly sessionRepository: AuthSessionRepository,
    private readonly scopeService: ScopeService,
    private readonly auditService: AuditService,
    private readonly assignmentService: CustomerAssignmentService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Assembles the WHERE clause for a customer query.
   *
   * Deliberately public and shared: the list, the detail lookup, the
   * summary aggregate and — from phase 10 — every export call this, so an
   * export can never return a row the list would not. Building the export
   * query separately is how scoping quietly gets bypassed.
   */
  async buildListConditions(actor: ICurrentStaff, filters: CustomerFilterDto): Promise<SQL[]> {
    const conditions: SQL[] = [isNull(customers.deletedAt)];

    // The scope predicate comes first and is never optional.
    const scope = await this.scopeService.customerScope(actor, {
      managerId: filters.managerId,
      runnerId: filters.runnerId,
    });
    if (scope) conditions.push(scope);

    if (filters.status) conditions.push(eq(customers.status, filters.status));
    if (filters.city) conditions.push(eq(customers.city, filters.city));
    if (filters.country) conditions.push(eq(customers.country, filters.country));
    if (filters.emailOptOut !== undefined) {
      conditions.push(eq(customers.emailOptOut, filters.emailOptOut));
    }

    // "Active" is activity-based, not the status column: status says what
    // staff decided, lastActivityAt says whether the customer is actually
    // using the account.
    if (filters.isActive !== undefined) {
      const windowDays =
        filters.activeWindowDays ??
        this.configService.get<number>('business.activeCustomerWindowDays', 30);
      const cutoff = new Date(Date.now() - windowDays * 86_400_000);

      conditions.push(
        filters.isActive
          ? and(eq(customers.status, CustomerStatus.ACTIVE), gte(customers.lastActivityAt, cutoff))!
          : sql`(${customers.status} <> ${CustomerStatus.ACTIVE}
                 OR ${customers.lastActivityAt} IS NULL
                 OR ${customers.lastActivityAt} < ${cutoff})`,
      );
    }

    const range = this.dateRange(filters);
    if (range.from) conditions.push(gte(customers.registeredAt, range.from));
    if (range.to) conditions.push(sql`${customers.registeredAt} <= ${range.to}`);

    return conditions;
  }

  async findAll(
    actor: ICurrentStaff,
    filters: CustomerFilterDto,
  ): Promise<IPaginatedResult<CustomerResponseDto, CustomerListSummaryDto>> {
    const conditions = await this.buildListConditions(actor, filters);

    const result = await this.customerRepository.findPaginated(filters, {
      conditions,
      searchColumns: this.customerRepository.searchColumns,
      sortableColumns: this.customerRepository.sortableColumns,
      defaultSort: { column: customers.createdAt, order: SortOrder.DESC },
    });

    // Owner names and money aggregates are resolved for the page only, so
    // the list query stays a plain indexed scan rather than a wide join.
    const [ownerNames, totals] = await Promise.all([
      this.resolveOwnerNames(result.data),
      this.transactionRepository.totalsForCustomers(result.data.map((row) => row.id)),
    ]);

    return {
      data: result.data.map((row) => this.toResponse(row, ownerNames, totals.get(row.id))),
      meta: result.meta,
      summary: await this.summarise(conditions, filters),
    };
  }

  /**
   * Aggregates over the entire filtered set.
   *
   * A second query against the same WHERE clause rather than a reduction
   * over the current page: summing 25 rows would report the page's totals
   * and call them the list's.
   */
  private async summarise(
    conditions: SQL[],
    filters: CustomerFilterDto,
  ): Promise<CustomerListSummaryDto> {
    const windowDays =
      filters.activeWindowDays ??
      this.configService.get<number>('business.activeCustomerWindowDays', 30);
    const cutoff = new Date(Date.now() - windowDays * 86_400_000);

    const [row] = await this.db
      .select({
        totalCustomers: count(),
        activeCustomers: sql<number>`count(*) FILTER (
          WHERE ${customers.status} = ${CustomerStatus.ACTIVE}
            AND ${customers.lastActivityAt} >= ${cutoff}
        )`,
        inactiveCustomers: sql<number>`count(*) FILTER (
          WHERE ${customers.status} = ${CustomerStatus.INACTIVE}
             OR ${customers.lastActivityAt} IS NULL
             OR ${customers.lastActivityAt} < ${cutoff}
        )`,
        suspendedCustomers: sql<number>`count(*) FILTER (
          WHERE ${customers.status} IN (${CustomerStatus.SUSPENDED}, ${CustomerStatus.BANNED})
        )`,
        totalBalance: sum(customers.balance),
        totalBonusBalance: sum(customers.bonusBalance),
      })
      .from(customers)
      .where(and(...conditions));

    return {
      totalCustomers: Number(row?.totalCustomers ?? 0),
      activeCustomers: Number(row?.activeCustomers ?? 0),
      inactiveCustomers: Number(row?.inactiveCustomers ?? 0),
      suspendedCustomers: Number(row?.suspendedCustomers ?? 0),
      totalBalance: row?.totalBalance ?? '0.00',
      totalBonusBalance: row?.totalBonusBalance ?? '0.00',
    };
  }

  /** Scope-filtered lookup. Outside the actor's chain resolves to 404. */
  async findOne(actor: ICurrentStaff, id: string): Promise<CustomerResponseDto> {
    const scope = await this.scopeService.customerScope(actor);
    const customer = await this.customerRepository.findByIdScoped(id, scope);

    if (!customer) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }

    const [ownerNames, totals] = await Promise.all([
      this.resolveOwnerNames([customer]),
      this.transactionRepository.totalsForCustomers([customer.id]),
    ]);
    return this.toResponse(customer, ownerNames, totals.get(customer.id));
  }

  async create(actor: ICurrentStaff, dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    // A runner can only ever create customers for themselves, so the
    // supplied ownerStaffId is ignored rather than validated.
    const ownerStaffId =
      actor.role === StaffRole.RUNNER ? actor.id : (dto.ownerStaffId ?? actor.id);

    // A manager assigning to a runner must own that runner; reuse the same
    // check the staff module uses rather than re-deriving it here.
    if (ownerStaffId !== actor.id) {
      await this.assertCanAssignTo(actor, ownerStaffId);
    }

    const ownership = await this.assignmentService.resolveOwnership(ownerStaffId);

    if (await this.customerRepository.emailTaken(dto.email)) {
      throw new ResourceConflictException(
        ErrorCode.CUSTOMER_EMAIL_TAKEN,
        'A customer with this email already exists',
      );
    }
    if (await this.customerRepository.usernameTaken(dto.username)) {
      throw new ResourceConflictException(
        ErrorCode.CUSTOMER_USERNAME_TAKEN,
        'A customer with this username already exists',
      );
    }

    const created = await this.customerRepository.create({
      email: dto.email,
      username: dto.username,
      passwordHash: await HashUtil.hashPassword(dto.password),
      fullName: dto.fullName,
      phone: dto.phone,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      notes: dto.notes,
      ...ownership,
      createdByStaffId: actor.id,
    });

    await this.audit(actor, 'customer.create', created.id, undefined, {
      email: created.email,
      username: created.username,
      ...ownership,
    });

    return this.toResponse(created);
  }

  async update(
    actor: ICurrentStaff,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const existing = await this.requireScoped(actor, id);

    if (dto.email && (await this.customerRepository.emailTaken(dto.email, id))) {
      throw new ResourceConflictException(
        ErrorCode.CUSTOMER_EMAIL_TAKEN,
        'A customer with this email already exists',
      );
    }

    const updated = await this.customerRepository.update(id, dto);

    await this.audit(
      actor,
      'customer.update',
      id,
      { email: existing.email, fullName: existing.fullName, city: existing.city },
      { ...dto },
    );

    return this.toResponse(updated as Customer);
  }

  /**
   * Sets a customer's password on their behalf.
   *
   * Customers cannot change their own credentials at all, so this is the
   * only path. Every session is revoked, otherwise the previous holder
   * keeps a usable refresh token.
   */
  async setPassword(
    actor: ICurrentStaff,
    id: string,
    dto: SetCustomerPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    await this.requireScoped(actor, id);

    await this.customerRepository.update(id, {
      passwordHash: await HashUtil.hashPassword(dto.newPassword),
    });

    const revokedSessions = await this.sessionRepository.revokeAllForSubject(
      AuthRealm.CUSTOMER,
      id,
      'password_reset',
    );

    await this.audit(actor, 'customer.password_reset', id, undefined, undefined, {
      revokedSessions,
    });

    return { revokedSessions };
  }

  async changeStatus(
    actor: ICurrentStaff,
    id: string,
    dto: ChangeCustomerStatusDto,
  ): Promise<CustomerResponseDto> {
    const existing = await this.requireScoped(actor, id);
    const updated = await this.customerRepository.update(id, { status: dto.status });

    // Suspension and banning must end access immediately, not whenever the
    // current access token happens to expire.
    let revokedSessions = 0;
    if (dto.status === CustomerStatus.SUSPENDED || dto.status === CustomerStatus.BANNED) {
      revokedSessions = await this.sessionRepository.revokeAllForSubject(
        AuthRealm.CUSTOMER,
        id,
        `status_${dto.status}`,
      );
    }

    await this.audit(
      actor,
      'customer.status_change',
      id,
      { status: existing.status },
      { status: dto.status },
      { reason: dto.reason, revokedSessions },
    );

    return this.toResponse(updated as Customer);
  }

  async reassign(
    actor: ICurrentStaff,
    id: string,
    dto: ReassignCustomerDto,
  ): Promise<CustomerResponseDto> {
    const existing = await this.requireScoped(actor, id);
    await this.assertCanAssignTo(actor, dto.ownerStaffId);

    await this.db.transaction(async (tx) => {
      await this.assignmentService.reassignCustomer(
        tx as unknown as DrizzleDB,
        id,
        dto.ownerStaffId,
      );
    });

    await this.audit(
      actor,
      'customer.reassign',
      id,
      {
        ownerStaffId: existing.ownerStaffId,
        managerId: existing.managerId,
        runnerId: existing.runnerId,
      },
      { ownerStaffId: dto.ownerStaffId },
    );

    const updated = await this.customerRepository.findById(id);
    return this.toResponse(updated as Customer);
  }

  async remove(actor: ICurrentStaff, id: string): Promise<null> {
    await this.requireScoped(actor, id);

    await this.customerRepository.softDelete(id);
    await this.sessionRepository.revokeAllForSubject(AuthRealm.CUSTOMER, id, 'account_deleted');

    await this.audit(actor, 'customer.delete', id);
    return null;
  }

  // ── Bulk ────────────────────────────────────────────────────

  /**
   * Applies a status to many customers at once.
   *
   * The supplied ids are intersected with the actor's scope rather than
   * trusted, so an id from another chain is silently dropped and reported
   * in `skipped` instead of being acted on.
   */
  async bulkChangeStatus(
    actor: ICurrentStaff,
    ids: string[],
    status: CustomerStatus,
  ): Promise<{ updated: number; skipped: number }> {
    const permitted = await this.intersectWithScope(actor, ids);

    if (permitted.length > 0) {
      await this.db.update(customers).set({ status }).where(inArray(customers.id, permitted));

      if (status === CustomerStatus.SUSPENDED || status === CustomerStatus.BANNED) {
        for (const id of permitted) {
          await this.sessionRepository.revokeAllForSubject(
            AuthRealm.CUSTOMER,
            id,
            `status_${status}`,
          );
        }
      }
    }

    await this.audit(actor, 'customer.bulk_status_change', undefined, undefined, undefined, {
      status,
      requested: ids.length,
      updated: permitted.length,
      skipped: ids.length - permitted.length,
    });

    return { updated: permitted.length, skipped: ids.length - permitted.length };
  }

  async bulkReassign(
    actor: ICurrentStaff,
    ids: string[],
    ownerStaffId: string,
  ): Promise<{ updated: number; skipped: number }> {
    await this.assertCanAssignTo(actor, ownerStaffId);

    const permitted = await this.intersectWithScope(actor, ids);
    const ownership = await this.assignmentService.resolveOwnership(ownerStaffId);

    if (permitted.length > 0) {
      await this.db.update(customers).set(ownership).where(inArray(customers.id, permitted));
    }

    await this.audit(actor, 'customer.bulk_reassign', undefined, undefined, undefined, {
      ownerStaffId,
      requested: ids.length,
      updated: permitted.length,
      skipped: ids.length - permitted.length,
    });

    return { updated: permitted.length, skipped: ids.length - permitted.length };
  }

  // ── Internals ───────────────────────────────────────────────

  /** Narrows caller-supplied ids to those actually inside the actor's scope. */
  private async intersectWithScope(actor: ICurrentStaff, ids: string[]): Promise<string[]> {
    const scope = await this.scopeService.customerScope(actor);
    const conditions: SQL[] = [inArray(customers.id, ids), isNull(customers.deletedAt)];
    if (scope) conditions.push(scope);

    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(...conditions));

    return rows.map((row) => row.id);
  }

  private async requireScoped(actor: ICurrentStaff, id: string): Promise<Customer> {
    const scope = await this.scopeService.customerScope(actor);
    const customer = await this.customerRepository.findByIdScoped(id, scope);

    if (!customer) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }
    return customer;
  }

  /**
   * Verifies the actor may hand a customer to the target staff member.
   *
   * resolveOwnership already rejects a master or a non-existent owner;
   * this adds the chain check, so a manager cannot assign a customer into
   * another manager's team.
   */
  private async assertCanAssignTo(actor: ICurrentStaff, ownerStaffId: string): Promise<void> {
    if (actor.role === StaffRole.MASTER) return;

    const visible = await this.scopeService.visibleStaffIds(actor);
    if (visible !== null && !visible.includes(ownerStaffId)) {
      throw new ResourceNotFoundException(
        ErrorCode.STAFF_NOT_FOUND,
        'The target owner is not part of your team',
      );
    }
  }

  private dateRange(filters: CustomerFilterDto): { from?: Date; to?: Date } {
    if (filters.lastNDays) {
      return { from: new Date(Date.now() - filters.lastNDays * 86_400_000) };
    }
    return { from: filters.dateFrom, to: filters.dateTo };
  }

  /** Resolves owner usernames for a page of rows in one round trip. */
  private async resolveOwnerNames(rows: Customer[]): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        rows.flatMap((row) => [row.managerId, row.runnerId].filter((id): id is string => !!id)),
      ),
    ];
    if (ids.length === 0) return new Map();

    const staff = await this.db
      .select({ id: staffUsers.id, username: staffUsers.username })
      .from(staffUsers)
      .where(inArray(staffUsers.id, ids));

    return new Map(staff.map((row) => [row.id, row.username]));
  }

  private async audit(
    actor: ICurrentStaff,
    action: string,
    entityId?: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'customer',
      entityId: entityId ?? null,
      before: before ?? null,
      after: after ?? null,
      metadata: metadata ?? null,
    });
  }

  /** Maps a row to its response shape. Never exposes passwordHash. */
  private toResponse(
    customer: Customer,
    ownerNames?: Map<string, string>,
    totals?: ICustomerTotals,
  ): CustomerResponseDto {
    return {
      id: customer.id,
      email: customer.email,
      username: customer.username,
      fullName: customer.fullName,
      phone: customer.phone,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      status: customer.status,
      balance: customer.balance,
      bonusBalance: customer.bonusBalance,
      ownerStaffId: customer.ownerStaffId,
      managerId: customer.managerId,
      runnerId: customer.runnerId,
      managerUsername: customer.managerId ? (ownerNames?.get(customer.managerId) ?? null) : null,
      runnerUsername: customer.runnerId ? (ownerNames?.get(customer.runnerId) ?? null) : null,
      emailOptOut: customer.emailOptOut,
      lastActivityAt: customer.lastActivityAt,
      lastLoginAt: customer.lastLoginAt,
      registeredAt: customer.registeredAt,
      notes: customer.notes,
      createdAt: customer.createdAt,

      // Zeroed rather than omitted when a customer has no transactions, so
      // the shape is stable and clients need no null-checking.
      totalTransactions: totals?.totalTransactions ?? 0,
      totalSpent: totals?.totalSpent ?? '0.00',
      totalWithdrawn: totals?.totalWithdrawn ?? '0.00',
      totalCorrections: totals?.totalCorrections ?? '0.00',
      netBalance: totals?.netBalance ?? '0.00',
      lastTransactionAt: totals?.lastTransactionAt ?? null,
    };
  }
}
