import { Inject, Injectable } from '@nestjs/common';
import { eq, SQL } from 'drizzle-orm';
import { StaffRole, AuthRealm, SortOrder } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  BusinessException,
  CapabilityDeniedException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { HashUtil } from '@common/utils/hash.util';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { StaffRepository } from '@database/repositories/staff.repository';
import { AuthSessionRepository } from '@database/repositories/auth-session.repository';
import { staffUsers, StaffUser } from '@database/schema/staff-users.schema';
import { ScopeService } from '@shared/scope/scope.service';
import { AuditService } from '@shared/audit/audit.service';
import { CustomerAssignmentService } from './customer-assignment.service';
import {
  CreateStaffDto,
  UpdateStaffDto,
  ResetStaffPasswordDto,
  ReassignRunnerDto,
  StaffFilterDto,
  StaffResponseDto,
} from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly staffRepository: StaffRepository,
    private readonly sessionRepository: AuthSessionRepository,
    private readonly scopeService: ScopeService,
    private readonly auditService: AuditService,
    private readonly assignmentService: CustomerAssignmentService,
  ) {}

  /**
   * Creates a manager or a runner.
   *
   * Who may create what:
   *   master  -> managers (parent = the master) and runners (parent must
   *              be an explicit manager)
   *   manager -> runners only, always parented to themselves. The
   *              supplied parentId is ignored rather than validated, so a
   *              manager cannot plant a runner in another manager's team.
   */
  async create(actor: ICurrentStaff, dto: CreateStaffDto): Promise<StaffResponseDto> {
    if (dto.role === StaffRole.MASTER) {
      throw new BusinessException(
        ErrorCode.STAFF_INVALID_HIERARCHY,
        'A master account cannot be created through this endpoint',
      );
    }

    const parentId = await this.resolveParent(actor, dto);

    if (await this.staffRepository.emailTaken(dto.email)) {
      throw new ResourceConflictException(
        ErrorCode.STAFF_EMAIL_TAKEN,
        'A staff account with this email already exists',
      );
    }
    if (await this.staffRepository.usernameTaken(dto.username)) {
      throw new ResourceConflictException(
        ErrorCode.STAFF_USERNAME_TAKEN,
        'A staff account with this username already exists',
      );
    }

    const created = await this.staffRepository.create({
      email: dto.email,
      username: dto.username,
      passwordHash: await HashUtil.hashPassword(dto.password),
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: dto.role,
      parentId,
      // The password was chosen by someone else, so it must be replaced
      // before the account is genuinely the holder's own.
      mustChangePassword: true,
      createdByStaffId: actor.id,
    });

    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'staff.create',
      entityType: 'staff',
      entityId: created.id,
      after: { email: created.email, username: created.username, role: created.role, parentId },
    });

    return this.toResponse(created);
  }

  async findAll(
    actor: ICurrentStaff,
    filters: StaffFilterDto,
  ): Promise<IPaginatedResult<StaffResponseDto>> {
    const conditions: SQL[] = [];

    const scope = this.scopeService.staffScope(actor);
    if (scope) conditions.push(scope);

    if (filters.role) conditions.push(eq(staffUsers.role, filters.role));
    if (filters.parentId) conditions.push(eq(staffUsers.parentId, filters.parentId));
    if (filters.isActive !== undefined) conditions.push(eq(staffUsers.isActive, filters.isActive));

    const result = await this.staffRepository.findPaginated(filters, {
      conditions,
      searchColumns: this.staffRepository.searchColumns,
      sortableColumns: this.staffRepository.sortableColumns,
      defaultSort: { column: staffUsers.createdAt, order: SortOrder.DESC },
    });

    return { ...result, data: result.data.map((row) => this.toResponse(row)) };
  }

  /** Scope-filtered lookup: a staff account outside the actor's view is 404. */
  async findOne(actor: ICurrentStaff, id: string): Promise<StaffResponseDto> {
    const scope = this.scopeService.staffScope(actor);
    const conditions = scope ? [eq(staffUsers.id, id), scope] : [eq(staffUsers.id, id)];

    const staff = await this.staffRepository.findOneBy(conditions);
    if (!staff) {
      throw new ResourceNotFoundException(ErrorCode.STAFF_NOT_FOUND, 'Staff member not found');
    }
    return this.toResponse(staff);
  }

  async update(actor: ICurrentStaff, id: string, dto: UpdateStaffDto): Promise<StaffResponseDto> {
    await this.scopeService.assertCanManageStaff(actor, id);
    return this.updateUnscoped(actor, id, dto);
  }

  async updateProfile(actor: ICurrentStaff, dto: UpdateStaffDto): Promise<StaffResponseDto> {
    return this.updateUnscoped(actor, actor.id, dto);
  }

  private async updateUnscoped(
    actor: ICurrentStaff,
    id: string,
    dto: UpdateStaffDto,
  ): Promise<StaffResponseDto> {
    const existing = await this.requireStaff(id);

    if (dto.email && (await this.staffRepository.emailTaken(dto.email, id))) {
      throw new ResourceConflictException(
        ErrorCode.STAFF_EMAIL_TAKEN,
        'A staff account with this email already exists',
      );
    }

    const updated = await this.staffRepository.update(id, dto);

    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'staff.update',
      entityType: 'staff',
      entityId: id,
      before: { email: existing.email, firstName: existing.firstName, lastName: existing.lastName },
      after: { ...dto },
    });

    return this.toResponse(updated as StaffUser);
  }

  /**
   * Sets a new password on behalf of another staff member.
   *
   * Every existing session is revoked: a password reset that leaves live
   * refresh tokens in circulation does not actually lock anyone out.
   */
  async resetPassword(
    actor: ICurrentStaff,
    id: string,
    dto: ResetStaffPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    await this.scopeService.assertCanManageStaff(actor, id);
    return this.resetPasswordUnscoped(actor, id, dto);
  }

  async resetOwnPassword(
    actor: ICurrentStaff,
    dto: ResetStaffPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    return this.resetPasswordUnscoped(actor, actor.id, dto);
  }

  private async resetPasswordUnscoped(
    actor: ICurrentStaff,
    id: string,
    dto: ResetStaffPasswordDto,
  ): Promise<{ revokedSessions: number }> {
    await this.requireStaff(id);

    await this.staffRepository.update(id, {
      passwordHash: await HashUtil.hashPassword(dto.newPassword),
      mustChangePassword: dto.mustChangePassword ?? true,
    });

    const revokedSessions = await this.sessionRepository.revokeAllForSubject(
      AuthRealm.TEAM,
      id,
      'password_reset',
    );

    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'staff.password_reset',
      entityType: 'staff',
      entityId: id,
      metadata: { revokedSessions },
    });

    return { revokedSessions };
  }

  /**
   * Activates or deactivates an account.
   *
   * Deactivation revokes every session, so access ends immediately rather
   * than when the current access token happens to expire.
   */
  async setActive(actor: ICurrentStaff, id: string, isActive: boolean): Promise<StaffResponseDto> {
    await this.scopeService.assertCanManageStaff(actor, id);
    const existing = await this.requireStaff(id);

    const updated = await this.staffRepository.update(id, { isActive });

    let revokedSessions = 0;
    if (!isActive) {
      revokedSessions = await this.sessionRepository.revokeAllForSubject(
        AuthRealm.TEAM,
        id,
        'account_disabled',
      );
    }

    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: isActive ? 'staff.activate' : 'staff.deactivate',
      entityType: 'staff',
      entityId: id,
      before: { isActive: existing.isActive },
      after: { isActive },
      metadata: { revokedSessions },
    });

    return this.toResponse(updated as StaffUser);
  }

  /**
   * Moves a runner to a different manager.
   *
   * The runner's customers carry a denormalised managerId, so it must be
   * rewritten in the same transaction. Skipping that would leave the old
   * manager still seeing those customers and the new one unable to — a
   * scope leak in both directions.
   */
  async reassignRunner(
    actor: ICurrentStaff,
    runnerId: string,
    dto: ReassignRunnerDto,
  ): Promise<StaffResponseDto> {
    if (actor.role !== StaffRole.MASTER) {
      throw new CapabilityDeniedException(
        ErrorCode.AUTH_FORBIDDEN_ROLE,
        'Only a master can move a runner between managers',
      );
    }

    const runner = await this.requireStaff(runnerId);
    if (runner.role !== StaffRole.RUNNER) {
      throw new BusinessException(
        ErrorCode.STAFF_INVALID_HIERARCHY,
        'Only a runner can be reassigned to a manager',
      );
    }

    const newManager = await this.staffRepository.findById(dto.newManagerId);
    if (!newManager || newManager.role !== StaffRole.MANAGER || !newManager.isActive) {
      throw new BusinessException(
        ErrorCode.STAFF_INVALID_HIERARCHY,
        'The target manager does not exist or is inactive',
      );
    }

    const cascaded = await this.db.transaction(async (tx) => {
      await tx
        .update(staffUsers)
        .set({ parentId: dto.newManagerId })
        .where(eq(staffUsers.id, runnerId));

      return this.assignmentService.recascadeRunnerCustomers(
        tx as unknown as DrizzleDB,
        runnerId,
        dto.newManagerId,
      );
    });

    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'staff.reassign_runner',
      entityType: 'staff',
      entityId: runnerId,
      before: { parentId: runner.parentId },
      after: { parentId: dto.newManagerId },
      metadata: { customersRecascaded: cascaded },
    });

    const updated = await this.staffRepository.findById(runnerId);
    return this.toResponse(updated as StaffUser);
  }

  /**
   * Soft-deletes an account.
   *
   * Refused while direct reports remain, because deleting a manager with
   * runners would orphan them and, through the denormalised managerId,
   * strand their customers outside every visible scope.
   */
  async remove(actor: ICurrentStaff, id: string): Promise<null> {
    await this.scopeService.assertCanManageStaff(actor, id);
    await this.requireStaff(id);

    if (await this.staffRepository.hasChildren(id)) {
      throw new ResourceConflictException(
        ErrorCode.STAFF_HAS_DEPENDENTS,
        "Reassign this account's direct reports before deleting it",
      );
    }

    await this.staffRepository.softDelete(id);
    await this.sessionRepository.revokeAllForSubject(AuthRealm.TEAM, id, 'account_deleted');

    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'staff.delete',
      entityType: 'staff',
      entityId: id,
    });

    return null;
  }

  // ── Internals ───────────────────────────────────────────────

  private async resolveParent(actor: ICurrentStaff, dto: CreateStaffDto): Promise<string> {
    if (actor.role === StaffRole.RUNNER) {
      throw new CapabilityDeniedException(
        ErrorCode.AUTH_FORBIDDEN_ROLE,
        'Runners cannot create staff accounts',
      );
    }

    if (actor.role === StaffRole.MANAGER) {
      if (dto.role !== StaffRole.RUNNER) {
        throw new CapabilityDeniedException(
          ErrorCode.AUTH_FORBIDDEN_ROLE,
          'Managers can only create runners',
        );
      }
      // Deliberately ignores dto.parentId: a manager's runners always
      // attach to that manager, so a supplied id cannot redirect them.
      return actor.id;
    }

    // Master.
    if (dto.role === StaffRole.MANAGER) {
      return actor.id;
    }

    if (!dto.parentId) {
      throw new BusinessException(
        ErrorCode.STAFF_INVALID_HIERARCHY,
        'parentId is required: a runner must be assigned to a manager',
      );
    }

    const manager = await this.staffRepository.findById(dto.parentId);
    if (!manager || manager.role !== StaffRole.MANAGER || !manager.isActive) {
      throw new BusinessException(
        ErrorCode.STAFF_INVALID_HIERARCHY,
        'parentId must reference an active manager',
      );
    }
    return manager.id;
  }

  private async requireStaff(id: string): Promise<StaffUser> {
    const staff = await this.staffRepository.findById(id);
    if (!staff) {
      throw new ResourceNotFoundException(ErrorCode.STAFF_NOT_FOUND, 'Staff member not found');
    }
    return staff;
  }

  /** Maps a row to its response shape. Never exposes passwordHash. */
  private toResponse(staff: StaffUser): StaffResponseDto {
    return {
      id: staff.id,
      email: staff.email,
      username: staff.username,
      firstName: staff.firstName,
      lastName: staff.lastName,
      phone: staff.phone,
      role: staff.role,
      parentId: staff.parentId,
      isActive: staff.isActive,
      mustChangePassword: staff.mustChangePassword,
      lastLoginAt: staff.lastLoginAt,
      createdAt: staff.createdAt,
    };
  }
}
