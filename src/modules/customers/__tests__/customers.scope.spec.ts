import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PgDialect } from 'drizzle-orm/pg-core';
import { and, SQL } from 'drizzle-orm';
import { CustomersService } from '../customers.service';
import { DRIZZLE_PROVIDER } from '@database/database.provider';
import { CustomerRepository } from '@database/repositories/customer.repository';
import { TransactionRepository } from '@database/repositories/transaction.repository';
import { AuthSessionRepository } from '@database/repositories/auth-session.repository';
import { ScopeService } from '@shared/scope/scope.service';
import { AuditService } from '@shared/audit/audit.service';
import { CustomerAssignmentService } from '@modules/staff/customer-assignment.service';
import { ReferralsService } from '@modules/referrals/referrals.service';
import { AuthRealm, CustomerStatus, StaffRole } from '@common/constants/app.constants';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { ResourceNotFoundException } from '@common/exceptions/business.exception';
import { CustomerFilterDto } from '../dto/customer.dto';

const MASTER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_A = '22222222-2222-4222-8222-222222222222';
const MANAGER_B = '33333333-3333-4333-8333-333333333333';
const RUNNER_A1 = '44444444-4444-4444-8444-444444444444';

const staff = (role: StaffRole, id: string, parentId: string | null): ICurrentStaff => ({
  id,
  realm: AuthRealm.TEAM,
  email: `${role}@test.local`,
  username: role,
  role,
  parentId,
});

const master = staff(StaffRole.MASTER, MASTER_ID, null);
const managerA = staff(StaffRole.MANAGER, MANAGER_A, MASTER_ID);
const runnerA1 = staff(StaffRole.RUNNER, RUNNER_A1, MANAGER_A);

const dialect = new PgDialect();
const renderAll = (conditions: SQL[]): string =>
  conditions.length ? dialect.sqlToQuery(and(...conditions)!).sql : '';

describe('CustomersService — scope composition', () => {
  let service: CustomersService;
  let scopeService: ScopeService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomersService,
        ScopeService,
        { provide: DRIZZLE_PROVIDER, useValue: { select: jest.fn(), update: jest.fn() } },
        { provide: CustomerRepository, useValue: {} },
        { provide: TransactionRepository, useValue: { totalsForCustomers: jest.fn() } },
        { provide: AuthSessionRepository, useValue: {} },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: CustomerAssignmentService, useValue: {} },
        { provide: ReferralsService, useValue: { attachReferral: jest.fn() } },
        {
          provide: 'StaffRepository',
          useValue: { findById: jest.fn(), findChildIds: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(30) } },
      ],
    })
      .overrideProvider(ScopeService)
      .useValue({
        customerScope: jest.fn(),
        visibleStaffIds: jest.fn(),
      })
      .compile();

    service = moduleRef.get(CustomersService);
    scopeService = moduleRef.get(ScopeService);
  });

  /**
   * The list, the detail lookup, the summary aggregate and every export
   * share buildListConditions. If the scope predicate ever stops being
   * included here, all four leak at once.
   */
  it('always includes the scope predicate in the conditions', async () => {
    const scopePredicate = and(
      // A stand-in for whatever ScopeService returns.
      dialectSafe(),
    )!;
    (scopeService.customerScope as jest.Mock).mockResolvedValue(scopePredicate);

    const conditions = await service.buildListConditions(managerA, new CustomerFilterDto());

    expect(scopeService.customerScope).toHaveBeenCalledWith(managerA, {
      managerId: undefined,
      runnerId: undefined,
    });
    expect(conditions.length).toBeGreaterThanOrEqual(2); // soft-delete + scope
  });

  it("passes the caller's ownership filters to ScopeService for validation", async () => {
    (scopeService.customerScope as jest.Mock).mockResolvedValue(undefined);

    const filters = new CustomerFilterDto();
    filters.managerId = MANAGER_B;
    filters.runnerId = RUNNER_A1;

    await service.buildListConditions(master, filters);

    // The service must not apply these itself: ScopeService decides
    // whether the actor is allowed to narrow that way.
    expect(scopeService.customerScope).toHaveBeenCalledWith(master, {
      managerId: MANAGER_B,
      runnerId: RUNNER_A1,
    });
  });

  it('propagates a scope rejection rather than swallowing it', async () => {
    (scopeService.customerScope as jest.Mock).mockRejectedValue(new ResourceNotFoundException());

    await expect(
      service.buildListConditions(managerA, new CustomerFilterDto()),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('always excludes soft-deleted rows', async () => {
    (scopeService.customerScope as jest.Mock).mockResolvedValue(undefined);

    const conditions = await service.buildListConditions(master, new CustomerFilterDto());

    expect(renderAll(conditions)).toContain('deleted_at');
  });

  describe('isActive filter', () => {
    beforeEach(() => {
      (scopeService.customerScope as jest.Mock).mockResolvedValue(undefined);
    });

    it('is activity-based, not merely the status column', async () => {
      const filters = new CustomerFilterDto();
      filters.isActive = true;

      const sql = renderAll(await service.buildListConditions(runnerA1, filters));

      // Both halves must be present: status alone would call a dormant
      // account active, and recency alone would include suspended ones.
      expect(sql).toContain('status');
      expect(sql).toContain('last_activity_at');
    });

    it('treats a null lastActivityAt as inactive', async () => {
      const filters = new CustomerFilterDto();
      filters.isActive = false;

      const sql = renderAll(await service.buildListConditions(runnerA1, filters));

      // A customer who has never been active must appear in the inactive
      // list; without the null check they would fall out of both.
      expect(sql).toContain('IS NULL');
    });

    it('is omitted entirely when the filter is absent', async () => {
      const sql = renderAll(await service.buildListConditions(runnerA1, new CustomerFilterDto()));

      expect(sql).not.toContain('last_activity_at');
    });
  });

  it('applies status, city and country filters when supplied', async () => {
    (scopeService.customerScope as jest.Mock).mockResolvedValue(undefined);

    const filters = new CustomerFilterDto();
    filters.status = CustomerStatus.SUSPENDED;
    filters.city = 'Pokhara';
    filters.country = 'Nepal';

    const sql = renderAll(await service.buildListConditions(master, filters));

    expect(sql).toContain('status');
    expect(sql).toContain('city');
    expect(sql).toContain('country');
  });
});

/** Minimal SQL fragment used as a stand-in scope predicate. */
function dialectSafe(): SQL {
  const { sql } = jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');
  return sql`1 = 1`;
}
