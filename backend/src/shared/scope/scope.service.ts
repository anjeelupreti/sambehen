import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, or, SQL, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { StaffRepository } from '@database/repositories/staff.repository';
import { StaffRole } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  CapabilityDeniedException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { ICurrentStaff } from '@common/interfaces/auth.interface';

/** Optional ownership narrowing a caller may request on a list. */
export interface IScopeFilters {
  managerId?: string;
  runnerId?: string;
}

/**
 * Row-level access control.
 *
 * This is the security boundary of the entire system. Every list, detail,
 * mutation, metric and export that touches customer-derived data composes
 * a predicate from here, so visibility is enforced in the data layer
 * rather than by a check a controller could forget.
 *
 * Visibility rules:
 *   MASTER  - everything; may narrow by any managerId / runnerId
 *   MANAGER - customers.manager_id = self; may narrow by runnerId, but
 *             only to a runner that is actually theirs
 *   RUNNER  - customers.runner_id = self; no narrowing
 *
 * Two deliberate choices worth knowing before changing anything here:
 *
 * 1. Predicates are returned as SQL, never as a materialised list of ids.
 *    An id list would not scale, and would silently truncate — a scope
 *    that quietly returns fewer rows is a correctness bug; one that
 *    quietly returns more is a data breach.
 *
 * 2. Denial of a specific row raises 404, not 403. A 403 confirms that a
 *    record belonging to another manager's chain exists, which is exactly
 *    what these rules exist to hide. 403 is reserved for capability
 *    denials, where the actor is not allowed to perform the action at all
 *    regardless of which row it targets.
 */
@Injectable()
export class ScopeService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly staffRepository: StaffRepository,
  ) {}

  /**
   * Predicate restricting `customers` to what the actor may see.
   *
   * Returns undefined for a master with no filters, meaning "no
   * restriction" — callers pass it straight into `and(...)`, which drops
   * undefined entries.
   */
  async customerScope(actor: ICurrentStaff, filters: IScopeFilters = {}): Promise<SQL | undefined> {
    switch (actor.role) {
      case StaffRole.MASTER:
        return this.masterCustomerScope(filters);

      case StaffRole.MANAGER:
        return this.managerCustomerScope(actor, filters);

      case StaffRole.RUNNER:
        return this.runnerCustomerScope(actor, filters);

      default:
        // Unreachable while StaffRole is exhaustive, but an unknown role
        // must deny everything rather than fall through to no predicate.
        return sql`false`;
    }
  }

  private masterCustomerScope(filters: IScopeFilters): SQL | undefined {
    const predicates: SQL[] = [];
    if (filters.managerId) predicates.push(eq(customers.managerId, filters.managerId));
    if (filters.runnerId) predicates.push(eq(customers.runnerId, filters.runnerId));
    return predicates.length > 0 ? and(...predicates) : undefined;
  }

  private async managerCustomerScope(
    actor: ICurrentStaff,
    filters: IScopeFilters,
  ): Promise<SQL | undefined> {
    // A manager narrowing by another manager's id must never widen their
    // own scope, so the manager filter is ignored unless it is themselves.
    if (filters.managerId && filters.managerId !== actor.id) {
      return sql`false`;
    }

    const predicates: SQL[] = [eq(customers.managerId, actor.id)];

    if (filters.runnerId) {
      // Validate the runner actually reports to this manager. Without
      // this, the AND below would still be safe, but the caller would get
      // a confusing empty list instead of a clear denial.
      await this.assertRunnerBelongsTo(actor.id, filters.runnerId);
      predicates.push(eq(customers.runnerId, filters.runnerId));
    }

    return and(...predicates);
  }

  private runnerCustomerScope(actor: ICurrentStaff, filters: IScopeFilters): SQL {
    // A runner is a leaf: any ownership filter that is not themselves is
    // a denial, not a narrowing.
    if (
      (filters.runnerId && filters.runnerId !== actor.id) ||
      (filters.managerId && filters.managerId !== actor.parentId)
    ) {
      return sql`false`;
    }
    return eq(customers.runnerId, actor.id);
  }

  /**
   * Predicate restricting `staff_users` to the accounts the actor may see.
   *
   *   MASTER  - all staff
   *   MANAGER - themselves and their own runners
   *   RUNNER  - themselves only
   */
  staffScope(actor: ICurrentStaff): SQL | undefined {
    switch (actor.role) {
      case StaffRole.MASTER:
        return undefined;

      case StaffRole.MANAGER:
        return or(eq(staffUsers.id, actor.id), eq(staffUsers.parentId, actor.id));

      case StaffRole.RUNNER:
        return eq(staffUsers.id, actor.id);

      default:
        return sql`false`;
    }
  }

  /**
   * Predicate for tables that carry a customer id (transactions,
   * conversations, referrals, VIP qualifications, spin winners).
   *
   * Expressed as a subquery against the scoped customer set rather than a
   * join, so callers can drop it into an existing WHERE clause without
   * restructuring their query.
   */
  async customerIdScope(
    customerIdColumn: SQL | { name: string },
    actor: ICurrentStaff,
    filters: IScopeFilters = {},
  ): Promise<SQL | undefined> {
    const scope = await this.customerScope(actor, filters);
    if (!scope) return undefined;

    return sql`${customerIdColumn} IN (SELECT ${customers.id} FROM ${customers} WHERE ${scope})`;
  }

  /**
   * Asserts the actor may act on a specific customer.
   *
   * Raises 404 on denial, deliberately indistinguishable from a genuinely
   * missing record.
   */
  async assertCanAccessCustomer(actor: ICurrentStaff, customerId: string): Promise<void> {
    const scope = await this.customerScope(actor);
    const conditions = scope
      ? [eq(customers.id, customerId), scope]
      : [eq(customers.id, customerId)];

    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(...conditions))
      .limit(1);

    if (rows.length === 0) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }
  }

  /**
   * Predicate restricting `staff_users` to who the actor may open an
   * internal DM with — a narrower list than `staffScope`, which also
   * includes the actor's own subordinates for *visibility* purposes but
   * says nothing about who a message may be addressed to.
   *
   *   MASTER  - everyone but themselves
   *   MANAGER - their own runners, plus any master
   *   RUNNER  - their own manager, plus any master
   *
   * Deliberately excludes peer managers and unrelated runners: the
   * hierarchy this walks is the same parentId chain ScopeService uses
   * everywhere else, not a separate permission list to keep in sync.
   */
  staffMessagingScope(actor: ICurrentStaff): SQL {
    switch (actor.role) {
      case StaffRole.MASTER:
        return sql`${staffUsers.id} != ${actor.id}`;

      case StaffRole.MANAGER:
        return and(
          sql`${staffUsers.id} != ${actor.id}`,
          or(eq(staffUsers.parentId, actor.id), eq(staffUsers.role, StaffRole.MASTER)),
        )!;

      case StaffRole.RUNNER:
        return and(
          sql`${staffUsers.id} != ${actor.id}`,
          or(
            actor.parentId ? eq(staffUsers.id, actor.parentId) : sql`false`,
            eq(staffUsers.role, StaffRole.MASTER),
          ),
        )!;

      default:
        return sql`false`;
    }
  }

  /**
   * Asserts the actor may open a DM with this specific staff member.
   *
   * Raises 403, not 404: the staff hierarchy is not secret (staffScope
   * already exposes it), so refusing by capability is the honest answer,
   * same reasoning as `assertCanManageStaff`.
   */
  async assertCanMessageStaff(actor: ICurrentStaff, targetStaffId: string): Promise<void> {
    if (actor.id === targetStaffId) {
      throw new CapabilityDeniedException(
        ErrorCode.STAFF_CANNOT_MESSAGE,
        'You cannot message yourself',
      );
    }

    const rows = await this.db
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(and(eq(staffUsers.id, targetStaffId), this.staffMessagingScope(actor)))
      .limit(1);

    if (rows.length === 0) {
      throw new CapabilityDeniedException(
        ErrorCode.STAFF_CANNOT_MESSAGE,
        'You can only message your own manager, your own runners, or a master',
      );
    }
  }

  /**
   * Asserts the actor may create or modify the target staff account.
   *
   *   MASTER  - anyone but themselves
   *   MANAGER - their own runners only
   *   RUNNER  - nobody
   *
   * Unlike customer access this raises 403: the staff hierarchy is not
   * secret, and refusing by capability is the honest answer.
   */
  async assertCanManageStaff(actor: ICurrentStaff, targetStaffId: string): Promise<void> {
    if (actor.id === targetStaffId) {
      throw new CapabilityDeniedException(
        ErrorCode.STAFF_CANNOT_MANAGE_PEER,
        'You cannot perform this action on your own account',
      );
    }

    if (actor.role === StaffRole.MASTER) return;

    if (actor.role === StaffRole.MANAGER) {
      const target = await this.staffRepository.findById(targetStaffId);
      if (!target || target.parentId !== actor.id) {
        throw new CapabilityDeniedException(
          ErrorCode.STAFF_CANNOT_MANAGE_PEER,
          'You can only manage runners that report to you',
        );
      }
      return;
    }

    throw new CapabilityDeniedException(
      ErrorCode.AUTH_FORBIDDEN_ROLE,
      'Runners cannot manage staff accounts',
    );
  }

  /**
   * Staff ids whose customers the actor can see, used where a predicate
   * cannot be composed (for example grouping a dashboard by owner).
   * Returns null for a master, meaning "unrestricted".
   */
  async visibleStaffIds(actor: ICurrentStaff): Promise<string[] | null> {
    switch (actor.role) {
      case StaffRole.MASTER:
        return null;
      case StaffRole.MANAGER: {
        const runnerIds = await this.staffRepository.findChildIds(actor.id);
        return [actor.id, ...runnerIds];
      }
      case StaffRole.RUNNER:
        return [actor.id];
      default:
        return [];
    }
  }

  /** Predicate limiting a staff-id column to the actor's visible set. */
  async staffIdScope(column: SQL, actor: ICurrentStaff): Promise<SQL | undefined> {
    const ids = await this.visibleStaffIds(actor);
    if (ids === null) return undefined;
    if (ids.length === 0) return sql`false`;
    return inArray(column, ids);
  }

  /** Throws unless the runner reports to the given manager. */
  private async assertRunnerBelongsTo(managerId: string, runnerId: string): Promise<void> {
    const runner = await this.staffRepository.findById(runnerId);

    if (!runner || runner.parentId !== managerId || runner.role !== StaffRole.RUNNER) {
      throw new ResourceNotFoundException(
        ErrorCode.STAFF_NOT_FOUND,
        'Runner not found in your team',
      );
    }
  }
}
