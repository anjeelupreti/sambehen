import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql, SQL, count } from 'drizzle-orm';
import { AuthRealm, SortOrder } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  BusinessException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { vipCriteria, VipCriteria } from '@database/schema/vip-criteria.schema';
import { vipQualifications } from '@database/schema/vip-qualifications.schema';
import { customers } from '@database/schema/customers.schema';
import { ScopeService } from '@shared/scope/scope.service';
import { AuditService } from '@shared/audit/audit.service';
import { VipQualificationService } from './vip-qualification.service';
import {
  CreateVipCriteriaDto,
  UpdateVipCriteriaDto,
  VipCriteriaFilterDto,
  VipFilterDto,
  VipCriteriaResponseDto,
  VipResponseDto,
  VipStatusDto,
} from './dto/vip.dto';

/** Fields whose change invalidates every qualification for a criteria. */
const RECOMPUTE_TRIGGERS = ['thresholdAmount', 'periodStart', 'periodEnd'] as const;

@Injectable()
export class VipService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly scopeService: ScopeService,
    private readonly auditService: AuditService,
    private readonly qualificationService: VipQualificationService,
  ) {}

  // ── Criteria ────────────────────────────────────────────────

  async createCriteria(
    actor: ICurrentStaff,
    dto: CreateVipCriteriaDto,
  ): Promise<VipCriteriaResponseDto> {
    this.assertValidPeriod(dto.periodStart, dto.periodEnd);
    await this.warnOnOverlap(dto.tier ?? 1, dto.periodStart, dto.periodEnd);

    const [created] = await this.db
      .insert(vipCriteria)
      .values({
        name: dto.name,
        description: dto.description,
        tier: dto.tier ?? 1,
        metric: dto.metric,
        thresholdAmount: dto.thresholdAmount,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        createdByStaffId: actor.id,
      })
      .returning();

    // Populate immediately: a criteria created over a past window should
    // list its VIPs at once, not after the nightly job.
    const result = await this.qualificationService.recomputeCriteria(created);

    await this.audit(actor, 'vip_criteria.create', created.id, undefined, { ...dto }, result);
    return this.toCriteriaResponse(created, result.qualified);
  }

  async findAllCriteria(
    filters: VipCriteriaFilterDto,
  ): Promise<IPaginatedResult<VipCriteriaResponseDto>> {
    const conditions: SQL[] = [isNull(vipCriteria.deletedAt)];

    if (filters.isActive !== undefined) {
      conditions.push(eq(vipCriteria.isActive, filters.isActive));
    }
    if (filters.currentlyActive) {
      conditions.push(
        eq(vipCriteria.isActive, true),
        sql`CURRENT_DATE BETWEEN ${vipCriteria.periodStart} AND ${vipCriteria.periodEnd}`,
      );
    }
    if (filters.tier) conditions.push(eq(vipCriteria.tier, filters.tier));
    if (filters.metric) conditions.push(eq(vipCriteria.metric, filters.metric));

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 25);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select()
        .from(vipCriteria)
        .where(and(...conditions))
        .orderBy(
          filters.sortOrder === SortOrder.ASC
            ? sql`${vipCriteria.periodStart} ASC`
            : sql`${vipCriteria.periodStart} DESC`,
        )
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ value: count() })
        .from(vipCriteria)
        .where(and(...conditions)),
    ]);

    const counts = await this.qualifiedCounts(rows.map((row) => row.id));
    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => this.toCriteriaResponse(row, counts.get(row.id) ?? 0)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findCriteria(id: string): Promise<VipCriteriaResponseDto> {
    const criteria = await this.requireCriteria(id);
    const counts = await this.qualifiedCounts([id]);
    return this.toCriteriaResponse(criteria, counts.get(id) ?? 0);
  }

  /**
   * Updates a criteria, recomputing when the change alters who qualifies.
   *
   * A threshold or window change invalidates every existing qualification,
   * so the rebuild runs inline rather than waiting for the nightly job —
   * a list that disagreed with its own criteria until midnight would be
   * worse than a slower request.
   */
  async updateCriteria(
    actor: ICurrentStaff,
    id: string,
    dto: UpdateVipCriteriaDto,
  ): Promise<VipCriteriaResponseDto> {
    const existing = await this.requireCriteria(id);

    const periodStart = dto.periodStart ?? existing.periodStart;
    const periodEnd = dto.periodEnd ?? existing.periodEnd;
    this.assertValidPeriod(periodStart, periodEnd);

    const [updated] = await this.db
      .update(vipCriteria)
      .set({ ...dto })
      .where(eq(vipCriteria.id, id))
      .returning();

    const needsRecompute = RECOMPUTE_TRIGGERS.some((field) => dto[field] !== undefined);
    const result = needsRecompute
      ? await this.qualificationService.recomputeCriteria(updated)
      : { qualified: 0, removed: 0 };

    await this.audit(
      actor,
      'vip_criteria.update',
      id,
      {
        thresholdAmount: existing.thresholdAmount,
        periodStart: existing.periodStart,
        periodEnd: existing.periodEnd,
      },
      { ...dto },
      { recomputed: needsRecompute, ...result },
    );

    const counts = await this.qualifiedCounts([id]);
    return this.toCriteriaResponse(updated, counts.get(id) ?? 0);
  }

  async removeCriteria(actor: ICurrentStaff, id: string): Promise<null> {
    await this.requireCriteria(id);
    await this.db.update(vipCriteria).set({ deletedAt: new Date() }).where(eq(vipCriteria.id, id));
    await this.audit(actor, 'vip_criteria.delete', id);
    return null;
  }

  /** Forces a rebuild, for when data was corrected outside the normal flow. */
  async recompute(
    actor: ICurrentStaff,
    id: string,
  ): Promise<{ qualified: number; removed: number }> {
    const criteria = await this.requireCriteria(id);
    const result = await this.qualificationService.recomputeCriteria(criteria);
    await this.audit(actor, 'vip_criteria.recompute', id, undefined, undefined, result);
    return result;
  }

  // ── VIP lists ───────────────────────────────────────────────

  /**
   * VIPs across every criteria and time frame.
   *
   * Scoped through the owning customer, so a store sees only their own
   * customers' qualifications. `activeOnly` narrows to windows containing
   * today — the current VIPs — while omitting it gives the historical
   * picture the spec asks for.
   */
  async findVips(
    actor: ICurrentStaff,
    filters: VipFilterDto,
  ): Promise<IPaginatedResult<VipResponseDto>> {
    const conditions: SQL[] = [isNull(vipCriteria.deletedAt), isNull(customers.deletedAt)];

    const scope = await this.scopeService.customerScope(actor, {
      managerId: filters.managerId,
      storeId: filters.storeId,
    });
    if (scope) conditions.push(scope);

    if (filters.customerId) conditions.push(eq(vipQualifications.customerId, filters.customerId));
    if (filters.criteriaId) conditions.push(eq(vipQualifications.criteriaId, filters.criteriaId));
    if (filters.tier) conditions.push(eq(vipCriteria.tier, filters.tier));
    if (filters.activeOnly) {
      conditions.push(
        eq(vipCriteria.isActive, true),
        sql`CURRENT_DATE BETWEEN ${vipCriteria.periodStart} AND ${vipCriteria.periodEnd}`,
      );
    }
    if (filters.search) {
      const term = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(
        sql`(${customers.username} ILIKE ${term} OR ${customers.fullName} ILIKE ${term} OR ${customers.email} ILIKE ${term})`,
      );
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 25);
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: vipQualifications.id,
          customerId: vipQualifications.customerId,
          customerUsername: customers.username,
          customerFullName: customers.fullName,
          criteriaId: vipCriteria.id,
          criteriaName: vipCriteria.name,
          tier: vipCriteria.tier,
          metric: vipCriteria.metric,
          achievedAmount: vipQualifications.achievedAmount,
          thresholdAmount: vipQualifications.thresholdAmount,
          periodStart: vipCriteria.periodStart,
          periodEnd: vipCriteria.periodEnd,
          isCurrentlyActive: sql<boolean>`(${vipCriteria.isActive}
            AND CURRENT_DATE BETWEEN ${vipCriteria.periodStart} AND ${vipCriteria.periodEnd})`,
          qualifiedAt: vipQualifications.qualifiedAt,
        })
        .from(vipQualifications)
        .innerJoin(vipCriteria, eq(vipQualifications.criteriaId, vipCriteria.id))
        .innerJoin(customers, eq(vipQualifications.customerId, customers.id))
        .where(where)
        .orderBy(sql`${vipQualifications.qualifiedAt} DESC`)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ value: count() })
        .from(vipQualifications)
        .innerJoin(vipCriteria, eq(vipQualifications.criteriaId, vipCriteria.id))
        .innerJoin(customers, eq(vipQualifications.customerId, customers.id))
        .where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows as VipResponseDto[],
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Customers eligible for a criteria, scoped to the actor.
   *
   * Feeds the spin-event winner picker: a preselected winner must already
   * hold a qualification for the event's criteria.
   */
  async findEligibleCustomers(
    actor: ICurrentStaff,
    criteriaId: string,
    filters: VipFilterDto,
  ): Promise<IPaginatedResult<VipResponseDto>> {
    await this.requireCriteria(criteriaId);
    return this.findVips(actor, { ...filters, criteriaId });
  }

  /** A customer's own standing against every currently-active criteria. */
  async statusFor(customerId: string): Promise<VipStatusDto> {
    const active = await this.db
      .select()
      .from(vipCriteria)
      .where(
        and(
          isNull(vipCriteria.deletedAt),
          eq(vipCriteria.isActive, true),
          sql`CURRENT_DATE BETWEEN ${vipCriteria.periodStart} AND ${vipCriteria.periodEnd}`,
        ),
      )
      .orderBy(sql`${vipCriteria.tier} DESC`);

    const entries = await Promise.all(
      active.map(async (criteria) => {
        const progress = await this.qualificationService.progressFor(customerId, criteria);
        return {
          criteriaId: criteria.id,
          name: criteria.name,
          tier: criteria.tier,
          metric: criteria.metric,
          achieved: progress.achieved,
          threshold: progress.threshold,
          percent: progress.percent,
          qualified: progress.qualified,
          periodStart: criteria.periodStart,
          periodEnd: criteria.periodEnd,
        };
      }),
    );

    const qualified = entries.filter((entry) => entry.qualified);

    return {
      isVip: qualified.length > 0,
      currentTier: qualified.length > 0 ? Math.max(...qualified.map((e) => e.tier)) : null,
      criteria: entries,
    };
  }

  // ── Internals ───────────────────────────────────────────────

  private assertValidPeriod(start: string, end: string): void {
    if (new Date(end) < new Date(start)) {
      throw new BusinessException(
        ErrorCode.VIP_INVALID_PERIOD,
        'periodEnd must be on or after periodStart',
        undefined,
        { periodStart: start, periodEnd: end },
      );
    }
  }

  /**
   * Overlapping windows within a tier are allowed but rarely intended: a
   * customer would hold the same tier twice for one span. Recorded in the
   * audit trail rather than refused, since a deliberate overlap is a
   * legitimate way to run a promotion alongside a standing programme.
   */
  private async warnOnOverlap(tier: number, start: string, end: string): Promise<void> {
    const overlapping = await this.db
      .select({ id: vipCriteria.id })
      .from(vipCriteria)
      .where(
        and(
          isNull(vipCriteria.deletedAt),
          eq(vipCriteria.tier, tier),
          sql`${vipCriteria.periodStart} <= ${end}::date`,
          sql`${vipCriteria.periodEnd} >= ${start}::date`,
        ),
      )
      .limit(1);

    if (overlapping.length > 0) {
      await this.auditService.record({
        actorType: AuthRealm.TEAM,
        action: 'vip_criteria.overlap_warning',
        entityType: 'vip_criteria',
        metadata: { tier, periodStart: start, periodEnd: end, overlapsWith: overlapping[0].id },
      });
    }
  }

  private async qualifiedCounts(criteriaIds: string[]): Promise<Map<string, number>> {
    if (criteriaIds.length === 0) return new Map();

    const rows = await this.db
      .select({ criteriaId: vipQualifications.criteriaId, value: count() })
      .from(vipQualifications)
      .where(inArray(vipQualifications.criteriaId, criteriaIds))
      .groupBy(vipQualifications.criteriaId);

    return new Map(rows.map((row) => [row.criteriaId, Number(row.value)]));
  }

  private async requireCriteria(id: string): Promise<VipCriteria> {
    const rows = await this.db
      .select()
      .from(vipCriteria)
      .where(and(eq(vipCriteria.id, id), isNull(vipCriteria.deletedAt)))
      .limit(1);

    if (!rows[0]) {
      throw new ResourceNotFoundException(
        ErrorCode.VIP_CRITERIA_NOT_FOUND,
        'VIP criteria not found',
      );
    }
    return rows[0];
  }

  private async audit(
    actor: ICurrentStaff,
    action: string,
    entityId: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'vip_criteria',
      entityId,
      before: before ?? null,
      after: after ?? null,
      metadata: metadata ?? null,
    });
  }

  private toCriteriaResponse(
    criteria: VipCriteria,
    qualifiedCount: number,
  ): VipCriteriaResponseDto {
    const today = new Date().toISOString().slice(0, 10);

    return {
      id: criteria.id,
      name: criteria.name,
      description: criteria.description,
      tier: criteria.tier,
      metric: criteria.metric,
      thresholdAmount: criteria.thresholdAmount,
      periodStart: criteria.periodStart,
      periodEnd: criteria.periodEnd,
      isActive: criteria.isActive,
      isCurrentlyActive:
        criteria.isActive && criteria.periodStart <= today && criteria.periodEnd >= today,
      qualifiedCount,
      createdAt: criteria.createdAt,
    };
  }
}
