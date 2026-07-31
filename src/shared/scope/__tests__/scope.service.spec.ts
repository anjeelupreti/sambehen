import { Test } from '@nestjs/testing';
import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ScopeService } from '../scope.service';
import { StaffRepository } from '@database/repositories/staff.repository';
import { DRIZZLE_PROVIDER } from '@database/database.provider';
import { AuthRealm, StaffRole } from '@common/constants/app.constants';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import {
  CapabilityDeniedException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';

const MASTER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_A = '22222222-2222-4222-8222-222222222222';
const MANAGER_B = '33333333-3333-4333-8333-333333333333';
const RUNNER_A1 = '44444444-4444-4444-8444-444444444444';
const RUNNER_B1 = '55555555-5555-4555-8555-555555555555';

const actor = (role: StaffRole, id: string, parentId: string | null): ICurrentStaff => ({
  id,
  realm: AuthRealm.TEAM,
  email: `${role}@test.local`,
  username: role,
  role,
  parentId,
});

const master = actor(StaffRole.MASTER, MASTER_ID, null);
const managerA = actor(StaffRole.MANAGER, MANAGER_A, MASTER_ID);
const runnerA1 = actor(StaffRole.RUNNER, RUNNER_A1, MANAGER_A);

/** Renders a predicate to SQL text so assertions read against real output. */
const dialect = new PgDialect();
const render = (predicate: SQL | undefined): string =>
  predicate ? dialect.sqlToQuery(predicate).sql : '<no restriction>';

/**
 * ScopeService is the security boundary of the entire system: every list,
 * metric and export composes a predicate from here. A regression is a data
 * breach, not a bug, so the role x resource matrix is covered exhaustively.
 */
describe('ScopeService', () => {
  let scopeService: ScopeService;
  let staffRepository: jest.Mocked<Pick<StaffRepository, 'findById' | 'findChildIds'>>;

  beforeEach(async () => {
    staffRepository = {
      findById: jest.fn(),
      findChildIds: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ScopeService,
        { provide: StaffRepository, useValue: staffRepository },
        { provide: DRIZZLE_PROVIDER, useValue: { select: jest.fn() } },
      ],
    }).compile();

    scopeService = moduleRef.get(ScopeService);
  });

  describe('customerScope', () => {
    it('does not restrict a master', async () => {
      await expect(scopeService.customerScope(master)).resolves.toBeUndefined();
    });

    it('restricts a manager to their own manager_id', async () => {
      const sql = render(await scopeService.customerScope(managerA));

      expect(sql).toContain('manager_id');
      expect(sql).not.toContain('runner_id');
    });

    it('restricts a runner to their own runner_id', async () => {
      const sql = render(await scopeService.customerScope(runnerA1));

      expect(sql).toContain('runner_id');
      expect(sql).not.toContain('manager_id');
    });

    it('lets a master narrow by manager and runner', async () => {
      const sql = render(
        await scopeService.customerScope(master, { managerId: MANAGER_B, runnerId: RUNNER_B1 }),
      );

      expect(sql).toContain('manager_id');
      expect(sql).toContain('runner_id');
    });

    it('denies a manager who filters by another manager', async () => {
      // The critical case: a manager must never widen scope by naming a
      // peer. A predicate of `false` returns nothing rather than
      // everything.
      const sql = render(await scopeService.customerScope(managerA, { managerId: MANAGER_B }));

      expect(sql).toBe('false');
    });

    it('allows a manager to narrow to one of their own runners', async () => {
      staffRepository.findById.mockResolvedValue({
        id: RUNNER_A1,
        parentId: MANAGER_A,
        role: StaffRole.RUNNER,
      } as never);

      const sql = render(await scopeService.customerScope(managerA, { runnerId: RUNNER_A1 }));

      expect(sql).toContain('manager_id');
      expect(sql).toContain('runner_id');
    });

    it("rejects a manager narrowing to another manager's runner", async () => {
      staffRepository.findById.mockResolvedValue({
        id: RUNNER_B1,
        parentId: MANAGER_B,
        role: StaffRole.RUNNER,
      } as never);

      await expect(
        scopeService.customerScope(managerA, { runnerId: RUNNER_B1 }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('rejects a manager narrowing to a runner that does not exist', async () => {
      staffRepository.findById.mockResolvedValue(undefined as never);

      await expect(
        scopeService.customerScope(managerA, { runnerId: RUNNER_B1 }),
      ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('denies a runner filtering by a different runner', async () => {
      const sql = render(await scopeService.customerScope(runnerA1, { runnerId: RUNNER_B1 }));

      expect(sql).toBe('false');
    });

    it('denies a runner filtering by a manager that is not their own', async () => {
      const sql = render(await scopeService.customerScope(runnerA1, { managerId: MANAGER_B }));

      expect(sql).toBe('false');
    });

    it('allows a runner filtering by themselves', async () => {
      const sql = render(await scopeService.customerScope(runnerA1, { runnerId: RUNNER_A1 }));

      expect(sql).toContain('runner_id');
      expect(sql).not.toBe('false');
    });

    it('denies an unknown role rather than falling through unrestricted', async () => {
      const rogue = { ...runnerA1, role: 'superuser' as StaffRole };

      expect(render(await scopeService.customerScope(rogue))).toBe('false');
    });
  });

  describe('staffScope', () => {
    it('does not restrict a master', () => {
      expect(scopeService.staffScope(master)).toBeUndefined();
    });

    it('limits a manager to themselves and their direct reports', () => {
      const sql = render(scopeService.staffScope(managerA));

      expect(sql).toContain('id');
      expect(sql).toContain('parent_id');
      expect(sql).toContain('or');
    });

    it('limits a runner to themselves only', () => {
      const sql = render(scopeService.staffScope(runnerA1));

      expect(sql).toContain('id');
      expect(sql).not.toContain('parent_id');
    });
  });

  describe('assertCanManageStaff', () => {
    it('refuses self-management for every role', async () => {
      // Self-deactivation would let an actor lock themselves out, and
      // self-role-change would be privilege escalation.
      await expect(scopeService.assertCanManageStaff(master, MASTER_ID)).rejects.toBeInstanceOf(
        CapabilityDeniedException,
      );
      await expect(scopeService.assertCanManageStaff(managerA, MANAGER_A)).rejects.toBeInstanceOf(
        CapabilityDeniedException,
      );
    });

    it('allows a master to manage anyone else', async () => {
      await expect(scopeService.assertCanManageStaff(master, MANAGER_B)).resolves.toBeUndefined();
    });

    it('allows a manager to manage their own runner', async () => {
      staffRepository.findById.mockResolvedValue({
        id: RUNNER_A1,
        parentId: MANAGER_A,
        role: StaffRole.RUNNER,
      } as never);

      await expect(scopeService.assertCanManageStaff(managerA, RUNNER_A1)).resolves.toBeUndefined();
    });

    it("refuses a manager managing another manager's runner", async () => {
      staffRepository.findById.mockResolvedValue({
        id: RUNNER_B1,
        parentId: MANAGER_B,
        role: StaffRole.RUNNER,
      } as never);

      await expect(scopeService.assertCanManageStaff(managerA, RUNNER_B1)).rejects.toBeInstanceOf(
        CapabilityDeniedException,
      );
    });

    it('refuses a manager managing a peer manager', async () => {
      staffRepository.findById.mockResolvedValue({
        id: MANAGER_B,
        parentId: MASTER_ID,
        role: StaffRole.MANAGER,
      } as never);

      await expect(scopeService.assertCanManageStaff(managerA, MANAGER_B)).rejects.toBeInstanceOf(
        CapabilityDeniedException,
      );
    });

    it('refuses a runner managing anyone', async () => {
      await expect(scopeService.assertCanManageStaff(runnerA1, RUNNER_B1)).rejects.toBeInstanceOf(
        CapabilityDeniedException,
      );
    });
  });

  describe('visibleStaffIds', () => {
    it('returns null (unrestricted) for a master', async () => {
      await expect(scopeService.visibleStaffIds(master)).resolves.toBeNull();
    });

    it('returns a manager plus their runners', async () => {
      staffRepository.findChildIds.mockResolvedValue([RUNNER_A1]);

      await expect(scopeService.visibleStaffIds(managerA)).resolves.toEqual([MANAGER_A, RUNNER_A1]);
    });

    it('returns only the runner themselves', async () => {
      await expect(scopeService.visibleStaffIds(runnerA1)).resolves.toEqual([RUNNER_A1]);
    });
  });
});
