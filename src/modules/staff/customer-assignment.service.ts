import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { StaffRole } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import { BusinessException } from '@common/exceptions/business.exception';
import { StaffRepository } from '@database/repositories/staff.repository';
import { DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { StaffUser } from '@database/schema/staff-users.schema';

/** The three ownership columns a customer row must carry consistently. */
export interface IOwnershipColumns {
  ownerStaffId: string;
  managerId: string;
  runnerId: string | null;
}

/**
 * Sole writer of the customer ownership columns.
 *
 * `customers` stores ownership three ways — ownerStaffId (truth),
 * managerId and runnerId (denormalised) — so ScopeService can express
 * visibility as one indexed equality instead of a recursive join. That
 * denormalisation is only safe while every write goes through here, so
 * services must never set these columns directly.
 *
 * A database CHECK constraint backs the same invariant, so a bug that got
 * past this service still cannot persist an inconsistent row.
 */
@Injectable()
export class CustomerAssignmentService {
  constructor(private readonly staffRepository: StaffRepository) {}

  /**
   * Derives the three ownership columns from a prospective owner.
   *
   * A runner contributes both its own id and its manager's; a manager
   * contributes itself and no runner. A master cannot own customers —
   * masters oversee the whole system, and letting one own rows directly
   * would create records that sit outside every manager's chain and so
   * appear in no manager's list.
   */
  async resolveOwnership(ownerStaffId: string): Promise<IOwnershipColumns> {
    const owner = await this.staffRepository.findById(ownerStaffId);

    if (!owner || !owner.isActive) {
      throw new BusinessException(
        ErrorCode.CUSTOMER_INVALID_OWNER,
        'The assigned owner does not exist or is inactive',
      );
    }

    switch (owner.role) {
      case StaffRole.RUNNER: {
        if (!owner.parentId) {
          // The hierarchy CHECK makes this unreachable, but an orphaned
          // runner would silently produce customers no manager can see.
          throw new BusinessException(
            ErrorCode.STAFF_INVALID_HIERARCHY,
            'This runner is not assigned to a manager',
          );
        }
        return { ownerStaffId: owner.id, managerId: owner.parentId, runnerId: owner.id };
      }

      case StaffRole.MANAGER:
        return { ownerStaffId: owner.id, managerId: owner.id, runnerId: null };

      case StaffRole.MASTER:
      default:
        throw new BusinessException(
          ErrorCode.CUSTOMER_INVALID_OWNER,
          'Customers must be assigned to a manager or a runner, not to a master',
        );
    }
  }

  /**
   * Reassigns a single customer, inside the caller's transaction.
   *
   * Takes the transaction handle so the ownership change commits together
   * with whatever else the caller is doing (audit entry, status change),
   * rather than leaving a window where the row is visible to neither the
   * old nor the new owner.
   */
  async reassignCustomer(
    tx: DrizzleDB,
    customerId: string,
    newOwnerStaffId: string,
  ): Promise<void> {
    const ownership = await this.resolveOwnership(newOwnerStaffId);
    await tx.update(customers).set(ownership).where(eq(customers.id, customerId));
  }

  /**
   * Rewrites the denormalised manager id for every customer of a runner
   * that has moved to a different manager.
   *
   * Without this, the runner's customers would keep pointing at the old
   * manager: the previous manager would keep seeing them and the new one
   * would not, which is a scope leak in both directions.
   */
  async recascadeRunnerCustomers(
    tx: DrizzleDB,
    runnerId: string,
    newManagerId: string,
  ): Promise<number> {
    const rows = await tx
      .update(customers)
      .set({ managerId: newManagerId })
      .where(eq(customers.runnerId, runnerId))
      .returning({ id: customers.id });
    return rows.length;
  }

  /** True when the actor may be assigned customers at all. */
  canOwnCustomers(staff: StaffUser): boolean {
    return staff.role === StaffRole.MANAGER || staff.role === StaffRole.RUNNER;
  }
}
