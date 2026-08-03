import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, isNull, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AuthRealm, SpinEventStatus, SpinSelectionMode } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import {
  BusinessException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@common/exceptions/business.exception';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { spinEvents, spinWinners, SpinEvent } from '@database/schema/spin-events.schema';
import { vipCriteria } from '@database/schema/vip-criteria.schema';
import { vipQualifications } from '@database/schema/vip-qualifications.schema';
import { customers } from '@database/schema/customers.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { AuditService } from '@shared/audit/audit.service';
import { ScopeService } from '@shared/scope/scope.service';
import {
  CreateSpinEventDto,
  UpdateSpinEventDto,
  RecordWinnersDto,
  SpinWinnerInputDto,
  SpinEventFilterDto,
  RecentWinnersFilterDto,
  SpinWinnersListFilterDto,
  SpinEventResponseDto,
  SpinWinnerResponseDto,
  SpinWinnerListItemDto,
  SpinWinnerSummaryDto,
  RecentWinnerDto,
} from './dto/spin.dto';

/** Statuses that still accept new winners. */
const OPEN_STATUSES: SpinEventStatus[] = [SpinEventStatus.SCHEDULED, SpinEventStatus.LIVE];

@Injectable()
export class SpinsService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly auditService: AuditService,
    private readonly scopeService: ScopeService,
  ) {}

  /**
   * Creates a spin event.
   *
   * The criteria must be currently active: an event attached to a closed
   * window would have a fixed eligibility set that no one could still join,
   * and one attached to a future window would accept winners before anyone
   * could qualify.
   *
   * In preselected mode the winners are supplied now and validated now, so
   * an event cannot be created naming someone who never qualified.
   */
  async createEvent(actor: ICurrentStaff, dto: CreateSpinEventDto): Promise<SpinEventResponseDto> {
    const criteria = await this.requireActiveCriteria(dto.vipCriteriaId);

    if (dto.selectionMode === SpinSelectionMode.PRESELECTED) {
      if (!dto.winners || dto.winners.length === 0) {
        throw new BusinessException(
          ErrorCode.SPIN_PRESELECTED_REQUIRES_WINNERS,
          'A preselected spin event must name its winners at creation',
        );
      }
    } else if (dto.winners && dto.winners.length > 0) {
      throw new BusinessException(
        ErrorCode.UNSUPPORTED_OPERATION,
        'Winners cannot be supplied for a post_draw event. Record them after the draw instead.',
      );
    }

    if (dto.winners) {
      await this.assertAllEligible(dto.vipCriteriaId, dto.winners);
      this.assertNoDuplicates(dto.winners);
    }

    const created = await this.db.transaction(async (tx) => {
      const [event] = await tx
        .insert(spinEvents)
        .values({
          name: dto.name,
          description: dto.description,
          vipCriteriaId: dto.vipCriteriaId,
          selectionMode: dto.selectionMode,
          scheduledAt: dto.scheduledAt,
          prizeDescription: dto.prizeDescription,
          prizePool: dto.prizePool,
          createdByStaffId: actor.id,
          status: this.statusFor(dto.scheduledAt, criteria.periodStart, criteria.periodEnd),
        })
        .returning();

      if (dto.winners?.length) {
        await tx.insert(spinWinners).values(
          dto.winners.map((winner) => ({
            spinEventId: event.id,
            customerId: winner.customerId,
            prizeLabel: winner.prizeLabel,
            prizeAmount: winner.prizeAmount,
            rank: winner.rank ?? 1,
            isPreselected: true,
            announcedAt: null,
            recordedByStaffId: actor.id,
          })),
        );
      }

      return event;
    });

    await this.audit(actor, 'spin_event.create', created.id, undefined, {
      name: dto.name,
      vipCriteriaId: dto.vipCriteriaId,
      selectionMode: dto.selectionMode,
      winnerCount: dto.winners?.length ?? 0,
    });

    return this.findEvent(created.id);
  }

  /**
   * Records winners after the draw.
   *
   * Applies the same eligibility rule as preselection, so how a winner was
   * determined never changes whether they were allowed to win.
   */
  async recordWinners(
    actor: ICurrentStaff,
    eventId: string,
    dto: RecordWinnersDto,
  ): Promise<SpinEventResponseDto> {
    const event = await this.requireEvent(eventId);

    if (!OPEN_STATUSES.includes(event.status)) {
      throw new BusinessException(
        ErrorCode.SPIN_EVENT_NOT_OPEN,
        `Winners cannot be recorded for a ${event.status} event`,
      );
    }

    this.assertNoDuplicates(dto.winners);
    await this.assertAllEligible(event.vipCriteriaId, dto.winners);

    // Refuse anyone already recorded for this event. The unique index
    // would catch it anyway, but a 409 naming the customer is far more
    // useful than a driver error.
    const existing = await this.db
      .select({ customerId: spinWinners.customerId })
      .from(spinWinners)
      .where(
        and(
          eq(spinWinners.spinEventId, eventId),
          inArray(
            spinWinners.customerId,
            dto.winners.map((w) => w.customerId),
          ),
        ),
      );

    if (existing.length > 0) {
      throw new ResourceConflictException(
        ErrorCode.SPIN_DUPLICATE_WINNER,
        'One or more customers have already been recorded as winners of this event',
        { alreadyRecorded: existing.map((row) => row.customerId) },
      );
    }

    const now = new Date();
    await this.db.insert(spinWinners).values(
      dto.winners.map((winner) => ({
        spinEventId: eventId,
        customerId: winner.customerId,
        prizeLabel: winner.prizeLabel,
        prizeAmount: winner.prizeAmount,
        rank: winner.rank ?? 1,
        isPreselected: false,
        announcedAt: now,
        recordedByStaffId: actor.id,
      })),
    );

    await this.audit(actor, 'spin_event.record_winners', eventId, undefined, {
      winnerCount: dto.winners.length,
      customerIds: dto.winners.map((w) => w.customerId),
    });

    return this.findEvent(eventId);
  }

  async findAllEvents(
    filters: SpinEventFilterDto,
  ): Promise<IPaginatedResult<SpinEventResponseDto>> {
    const conditions: SQL[] = [isNull(spinEvents.deletedAt)];

    if (filters.status) conditions.push(eq(spinEvents.status, filters.status));
    if (filters.selectionMode) conditions.push(eq(spinEvents.selectionMode, filters.selectionMode));
    if (filters.vipCriteriaId) conditions.push(eq(spinEvents.vipCriteriaId, filters.vipCriteriaId));
    if (filters.dateFrom) conditions.push(sql`${spinEvents.scheduledAt} >= ${filters.dateFrom}`);
    if (filters.dateTo) conditions.push(sql`${spinEvents.scheduledAt} <= ${filters.dateTo}`);
    if (filters.search) {
      const term = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(sql`${spinEvents.name} ILIKE ${term}`);
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 25);
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          event: spinEvents,
          criteriaName: vipCriteria.name,
          periodStart: vipCriteria.periodStart,
          periodEnd: vipCriteria.periodEnd,
          winnerCount: sql<number>`(
            SELECT COUNT(*) FROM ${spinWinners} WHERE ${spinWinners.spinEventId} = ${spinEvents.id}
          )`,
        })
        .from(spinEvents)
        .innerJoin(vipCriteria, eq(spinEvents.vipCriteriaId, vipCriteria.id))
        .where(where)
        .orderBy(desc(spinEvents.scheduledAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ value: count() }).from(spinEvents).where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) =>
        this.toEventResponse(
          row.event,
          row.criteriaName,
          row.periodStart,
          row.periodEnd,
          Number(row.winnerCount),
        ),
      ),
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

  async findEvent(id: string): Promise<SpinEventResponseDto> {
    const [row] = await this.db
      .select({
        event: spinEvents,
        criteriaName: vipCriteria.name,
        periodStart: vipCriteria.periodStart,
        periodEnd: vipCriteria.periodEnd,
      })
      .from(spinEvents)
      .innerJoin(vipCriteria, eq(spinEvents.vipCriteriaId, vipCriteria.id))
      .where(and(eq(spinEvents.id, id), isNull(spinEvents.deletedAt)))
      .limit(1);

    if (!row) {
      throw new ResourceNotFoundException(ErrorCode.SPIN_EVENT_NOT_FOUND, 'Spin event not found');
    }

    const winners = await this.winnersFor(id);

    return {
      ...this.toEventResponse(
        row.event,
        row.criteriaName,
        row.periodStart,
        row.periodEnd,
        winners.length,
      ),
      winners,
    };
  }

  async updateEvent(
    actor: ICurrentStaff,
    id: string,
    dto: UpdateSpinEventDto,
  ): Promise<SpinEventResponseDto> {
    const existing = await this.requireEvent(id);

    const [updated] = await this.db
      .update(spinEvents)
      .set({ ...dto })
      .where(eq(spinEvents.id, id))
      .returning();

    await this.audit(
      actor,
      'spin_event.update',
      id,
      { status: existing.status, scheduledAt: existing.scheduledAt },
      { ...dto },
    );

    return this.findEvent(updated.id);
  }

  /**
   * Removes a recorded winner.
   *
   * Data entry is fallible and a winner keyed against the wrong customer
   * has to be removable. Audited with the full prior row so the correction
   * is reconstructable.
   */
  async removeWinner(actor: ICurrentStaff, eventId: string, winnerId: string): Promise<null> {
    await this.requireEvent(eventId);

    const [removed] = await this.db
      .delete(spinWinners)
      .where(and(eq(spinWinners.id, winnerId), eq(spinWinners.spinEventId, eventId)))
      .returning();

    if (!removed) {
      throw new ResourceNotFoundException(
        ErrorCode.NOT_FOUND,
        'Winner not found for this spin event',
      );
    }

    await this.audit(actor, 'spin_event.remove_winner', eventId, { ...removed }, undefined);
    return null;
  }

  async removeEvent(actor: ICurrentStaff, id: string): Promise<null> {
    await this.requireEvent(id);
    await this.db.update(spinEvents).set({ deletedAt: new Date() }).where(eq(spinEvents.id, id));
    await this.audit(actor, 'spin_event.delete', id);
    return null;
  }

  /**
   * Recent winners, with names partially masked.
   *
   * Shown to customers, so it must not leak identities: the customer id is
   * omitted entirely and the name is reduced to a recognisable-but-not-
   * identifying form. A customer seeing their own win should recognise it;
   * nobody else should be able to work out who won.
   */
  /**
   * The winners register, for staff.
   *
   * Deliberately separate from `recentWinners`. That feed is public-facing
   * and therefore masked and unscoped; this one names the customer, so it
   * is scoped through the customer exactly like transactions and referrals
   * are. A runner sees wins by their own customers and nobody else's —
   * otherwise the register would become a way to enumerate accounts in
   * another manager's chain, which is precisely what the masking in the
   * public feed exists to prevent.
   */
  async findWinners(
    actor: ICurrentStaff,
    filters: SpinWinnersListFilterDto,
  ): Promise<IPaginatedResult<SpinWinnerListItemDto, SpinWinnerSummaryDto>> {
    const conditions: SQL[] = [isNull(spinEvents.deletedAt)];

    const scope = await this.scopeService.customerIdScope(sql`${spinWinners.customerId}`, actor, {
      managerId: filters.managerId,
      runnerId: filters.runnerId,
    });
    if (scope) conditions.push(scope);

    if (filters.spinEventId) conditions.push(eq(spinWinners.spinEventId, filters.spinEventId));
    if (filters.customerId) conditions.push(eq(spinWinners.customerId, filters.customerId));
    if (filters.isPreselected !== undefined) {
      conditions.push(eq(spinWinners.isPreselected, filters.isPreselected));
    }

    const range = this.announcedRange(filters);
    if (range) conditions.push(range);

    if (filters.search) {
      const term = `%${filters.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      conditions.push(
        sql`(${customers.username} ILIKE ${term} OR ${customers.fullName} ILIKE ${term} OR ${spinEvents.name} ILIKE ${term})`,
      );
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(Math.max(1, filters.limit ?? 25), 100);
    const where = and(...conditions);

    // Managers and runners are joined for display only; ownership is
    // already enforced by the scope predicate above.
    const managers = alias(staffUsers, 'winner_manager');
    const runners = alias(staffUsers, 'winner_runner');

    const [rows, [totalRow], [summaryRow]] = await Promise.all([
      this.db
        .select({
          id: spinWinners.id,
          spinEventId: spinWinners.spinEventId,
          eventName: spinEvents.name,
          eventStatus: spinEvents.status,
          customerId: spinWinners.customerId,
          customerUsername: customers.username,
          customerFullName: customers.fullName,
          managerUsername: managers.username,
          runnerUsername: runners.username,
          prizeLabel: spinWinners.prizeLabel,
          prizeAmount: spinWinners.prizeAmount,
          rank: spinWinners.rank,
          isPreselected: spinWinners.isPreselected,
          announcedAt: spinWinners.announcedAt,
        })
        .from(spinWinners)
        .innerJoin(spinEvents, eq(spinWinners.spinEventId, spinEvents.id))
        .innerJoin(customers, eq(spinWinners.customerId, customers.id))
        .leftJoin(managers, eq(customers.managerId, managers.id))
        .leftJoin(runners, eq(customers.runnerId, runners.id))
        .where(where)
        .orderBy(...this.winnerOrder(filters))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ value: count() })
        .from(spinWinners)
        .innerJoin(spinEvents, eq(spinWinners.spinEventId, spinEvents.id))
        .innerJoin(customers, eq(spinWinners.customerId, customers.id))
        .where(where),
      // A second aggregate over the same WHERE, not a reduction over the
      // page — "total prizes" is only meaningful across the whole filter.
      this.db
        .select({
          totalWinners: count(),
          distinctCustomers: sql<number>`COUNT(DISTINCT ${spinWinners.customerId})`,
          totalPrizeAmount: sql<string>`COALESCE(SUM(${spinWinners.prizeAmount}), 0)::text`,
          preselectedCount: sql<number>`COUNT(*) FILTER (WHERE ${spinWinners.isPreselected})`,
        })
        .from(spinWinners)
        .innerJoin(spinEvents, eq(spinWinners.spinEventId, spinEvents.id))
        .innerJoin(customers, eq(spinWinners.customerId, customers.id))
        .where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows as SpinWinnerListItemDto[],
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      summary: {
        totalWinners: Number(summaryRow?.totalWinners ?? 0),
        distinctCustomers: Number(summaryRow?.distinctCustomers ?? 0),
        totalPrizeAmount: summaryRow?.totalPrizeAmount ?? '0',
        preselectedCount: Number(summaryRow?.preselectedCount ?? 0),
      },
    };
  }

  /** Date window over when the win was announced. */
  private announcedRange(filters: SpinWinnersListFilterDto): SQL | undefined {
    if (filters.lastNDays) {
      return sql`${spinWinners.announcedAt} >= NOW() - ${`${filters.lastNDays} days`}::interval`;
    }

    const bounds: SQL[] = [];
    if (filters.dateFrom) bounds.push(sql`${spinWinners.announcedAt} >= ${filters.dateFrom}`);
    if (filters.dateTo) bounds.push(sql`${spinWinners.announcedAt} <= ${filters.dateTo}`);
    return bounds.length > 0 ? and(...bounds) : undefined;
  }

  /** Whitelisted sort, with a primary-key tie-break so paging is stable. */
  private winnerOrder(filters: SpinWinnersListFilterDto): SQL[] {
    const direction = filters.sortOrder === 'asc' ? asc : desc;

    switch (filters.sortBy) {
      case 'rank':
        return [direction(spinWinners.rank), desc(spinWinners.id)];
      case 'prizeAmount':
        return [direction(spinWinners.prizeAmount), desc(spinWinners.id)];
      default:
        return [direction(spinWinners.announcedAt), desc(spinWinners.id)];
    }
  }

  async recentWinners(filters: RecentWinnersFilterDto): Promise<IPaginatedResult<RecentWinnerDto>> {
    const conditions: SQL[] = [isNull(spinEvents.deletedAt)];
    if (filters.spinEventId) conditions.push(eq(spinWinners.spinEventId, filters.spinEventId));

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 50);
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: spinWinners.id,
          fullName: customers.fullName,
          username: customers.username,
          eventName: spinEvents.name,
          prizeLabel: spinWinners.prizeLabel,
          prizeAmount: spinWinners.prizeAmount,
          rank: spinWinners.rank,
          announcedAt: spinWinners.announcedAt,
          createdAt: spinWinners.createdAt,
        })
        .from(spinWinners)
        .innerJoin(spinEvents, eq(spinWinners.spinEventId, spinEvents.id))
        .innerJoin(customers, eq(spinWinners.customerId, customers.id))
        .where(where)
        .orderBy(desc(sql`COALESCE(${spinWinners.announcedAt}, ${spinWinners.createdAt})`))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ value: count() })
        .from(spinWinners)
        .innerJoin(spinEvents, eq(spinWinners.spinEventId, spinEvents.id))
        .where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => ({
        id: row.id,
        displayName: this.maskName(row.fullName ?? row.username),
        eventName: row.eventName,
        prizeLabel: row.prizeLabel,
        prizeAmount: row.prizeAmount,
        rank: row.rank,
        announcedAt: row.announcedAt,
      })),
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

  // ── Internals ───────────────────────────────────────────────

  /**
   * Rejects any customer without a qualification for this criteria.
   *
   * Reads from vip_qualifications rather than recomputing, so eligibility
   * is decided by exactly the same rule the VIP lists use.
   */
  private async assertAllEligible(
    criteriaId: string,
    winners: SpinWinnerInputDto[],
  ): Promise<void> {
    const customerIds = winners.map((w) => w.customerId);

    const qualified = await this.db
      .select({ customerId: vipQualifications.customerId })
      .from(vipQualifications)
      .where(
        and(
          eq(vipQualifications.criteriaId, criteriaId),
          inArray(vipQualifications.customerId, customerIds),
        ),
      );

    const qualifiedIds = new Set(qualified.map((row) => row.customerId));
    const ineligible = customerIds.filter((id) => !qualifiedIds.has(id));

    if (ineligible.length > 0) {
      throw new BusinessException(
        ErrorCode.SPIN_WINNER_NOT_VIP,
        "One or more selected customers do not qualify for this event's VIP criteria",
        undefined,
        { ineligibleCustomerIds: ineligible, criteriaId },
      );
    }
  }

  private assertNoDuplicates(winners: SpinWinnerInputDto[]): void {
    const ids = winners.map((w) => w.customerId);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    if (duplicates.length > 0) {
      throw new ResourceConflictException(
        ErrorCode.SPIN_DUPLICATE_WINNER,
        'The same customer appears more than once in this request',
        { duplicateCustomerIds: [...new Set(duplicates)] },
      );
    }
  }

  private async requireActiveCriteria(
    criteriaId: string,
  ): Promise<{ periodStart: string; periodEnd: string }> {
    const [criteria] = await this.db
      .select()
      .from(vipCriteria)
      .where(and(eq(vipCriteria.id, criteriaId), isNull(vipCriteria.deletedAt)))
      .limit(1);

    if (!criteria) {
      throw new ResourceNotFoundException(
        ErrorCode.VIP_CRITERIA_NOT_FOUND,
        'VIP criteria not found',
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const active =
      criteria.isActive && criteria.periodStart <= today && criteria.periodEnd >= today;

    if (!active) {
      throw new BusinessException(
        ErrorCode.VIP_CRITERIA_INACTIVE,
        'A spin event can only run under a currently-active VIP criteria',
        undefined,
        {
          criteriaId,
          isActive: criteria.isActive,
          periodStart: criteria.periodStart,
          periodEnd: criteria.periodEnd,
          today,
        },
      );
    }

    return { periodStart: criteria.periodStart, periodEnd: criteria.periodEnd };
  }

  private async requireEvent(id: string): Promise<SpinEvent> {
    const [event] = await this.db
      .select()
      .from(spinEvents)
      .where(and(eq(spinEvents.id, id), isNull(spinEvents.deletedAt)))
      .limit(1);

    if (!event) {
      throw new ResourceNotFoundException(ErrorCode.SPIN_EVENT_NOT_FOUND, 'Spin event not found');
    }
    return event;
  }

  private async winnersFor(eventId: string): Promise<SpinWinnerResponseDto[]> {
    const rows = await this.db
      .select({
        id: spinWinners.id,
        customerId: spinWinners.customerId,
        customerUsername: customers.username,
        customerFullName: customers.fullName,
        prizeLabel: spinWinners.prizeLabel,
        prizeAmount: spinWinners.prizeAmount,
        rank: spinWinners.rank,
        isPreselected: spinWinners.isPreselected,
        announcedAt: spinWinners.announcedAt,
      })
      .from(spinWinners)
      .innerJoin(customers, eq(spinWinners.customerId, customers.id))
      .where(eq(spinWinners.spinEventId, eventId))
      .orderBy(spinWinners.rank);

    return rows;
  }

  /** Status an event should hold given its schedule and criteria window. */
  private statusFor(scheduledAt: Date, periodStart: string, periodEnd: string): SpinEventStatus {
    const today = new Date().toISOString().slice(0, 10);
    const windowOpen = periodStart <= today && periodEnd >= today;

    if (scheduledAt.getTime() > Date.now()) return SpinEventStatus.SCHEDULED;
    return windowOpen ? SpinEventStatus.LIVE : SpinEventStatus.COMPLETED;
  }

  /**
   * Masks a name for public display: first two characters, then stars,
   * then the last character, plus the initial of any surname.
   * "John Doe" becomes "Jo**n D." and short names stay fully masked.
   */
  private maskName(name: string): string {
    const [first, ...rest] = name.trim().split(/\s+/);

    const maskedFirst =
      first.length <= 2
        ? `${first[0] ?? ''}*`
        : `${first.slice(0, 2)}${'*'.repeat(Math.max(1, first.length - 3))}${first.slice(-1)}`;

    const surnameInitial = rest.length > 0 ? ` ${rest[rest.length - 1][0].toUpperCase()}.` : '';
    return `${maskedFirst}${surnameInitial}`;
  }

  private toEventResponse(
    event: SpinEvent,
    criteriaName: string,
    periodStart: string,
    periodEnd: string,
    winnerCount: number,
  ): SpinEventResponseDto {
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      vipCriteriaId: event.vipCriteriaId,
      vipCriteriaName: criteriaName,
      periodStart,
      periodEnd,
      selectionMode: event.selectionMode,
      status: event.status,
      scheduledAt: event.scheduledAt,
      prizeDescription: event.prizeDescription,
      prizePool: event.prizePool,
      winnerCount,
      createdAt: event.createdAt,
    };
  }

  private async audit(
    actor: ICurrentStaff,
    action: string,
    entityId: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'spin_event',
      entityId,
      before: before ?? null,
      after: after ?? null,
    });
  }
}
