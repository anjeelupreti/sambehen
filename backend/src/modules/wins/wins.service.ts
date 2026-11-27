import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, count, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { AuthRealm } from '@common/constants/app.constants';
import { ErrorCode } from '@common/constants/error-codes';
import { WIN_RECORDED, WinRecordedEvent } from '@common/events/domain-events';
import { ResourceNotFoundException } from '@common/exceptions/business.exception';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { games } from '@database/schema/games.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { bigWins } from '@database/schema/wins.schema';
import { AuditService } from '@shared/audit/audit.service';
import { ScopeService } from '@shared/scope/scope.service';
import { RecordWinDto, WinDto, WinFeedDto, WinFeedItemDto, WinListQueryDto } from './dto/win.dto';

/** "Jolene Harper" → "Jolene H."; a username alone → "jo***". */
export function publicName(fullName: string | null, username: string): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
  if (parts.length === 1) return parts[0];
  return `${username.slice(0, 2)}***`;
}

/**
 * Big wins: staff record them, players see them as a ticker and a board.
 *
 * Only real, recorded wins are ever shown. A player who turned off
 * "show my wins" never appears, and staff can hide any single win.
 */
@Injectable()
export class WinsService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly scopeService: ScopeService,
    private readonly auditService: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Staff ────────────────────────────────────────────────────

  async record(actor: ICurrentStaff, dto: RecordWinDto): Promise<WinDto> {
    const scope = await this.scopeService.customerScope(actor);
    const [customer] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, dto.customerId), isNull(customers.deletedAt), scope))
      .limit(1);
    if (!customer) {
      throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
    }
    if (dto.gameId) {
      const [game] = await this.db
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.id, dto.gameId), isNull(games.deletedAt)))
        .limit(1);
      if (!game) throw new ResourceNotFoundException(ErrorCode.GAME_NOT_FOUND, 'Game not found');
    }

    const [row] = await this.db
      .insert(bigWins)
      .values({
        customerId: dto.customerId,
        gameId: dto.gameId ?? null,
        amount: dto.amount,
        wonAt: dto.wonAt ? new Date(dto.wonAt) : new Date(),
        recordedByStaffId: actor.id,
      })
      .returning();

    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'win.recorded',
      entityType: 'customer',
      entityId: dto.customerId,
      before: null,
      after: { amount: dto.amount, gameId: dto.gameId ?? null },
      metadata: { winId: row.id },
    });

    await this.announce(row.id);
    return this.requireWin(actor, row.id);
  }

  async list(actor: ICurrentStaff, query: WinListQueryDto): Promise<IPaginatedResult<WinDto>> {
    const scope = await this.scopeService.customerScope(actor);
    const where = and(isNull(customers.deletedAt), scope);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);

    const [rows, [total]] = await Promise.all([
      this.staffQuery()
        .where(where)
        .orderBy(desc(bigWins.wonAt), desc(bigWins.id))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ value: count() })
        .from(bigWins)
        .innerJoin(customers, eq(customers.id, bigWins.customerId))
        .where(where),
    ]);

    const totalCount = Number(total?.value ?? 0);
    const totalPages = Math.ceil(totalCount / limit);
    return {
      data: rows.map((row) => this.toStaff(row)),
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async setHidden(actor: ICurrentStaff, id: string, hidden: boolean): Promise<WinDto> {
    const win = await this.requireWin(actor, id);
    await this.db
      .update(bigWins)
      .set({ hiddenAt: hidden ? new Date() : null })
      .where(eq(bigWins.id, id));
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: hidden ? 'win.hidden' : 'win.shown',
      entityType: 'customer',
      entityId: win.customerId,
      before: { hidden: win.hidden },
      after: { hidden },
      metadata: { winId: id },
    });
    if (!hidden && win.hidden) await this.announce(id);
    return this.requireWin(actor, id);
  }

  async remove(actor: ICurrentStaff, id: string): Promise<void> {
    const win = await this.requireWin(actor, id);
    await this.db.delete(bigWins).where(eq(bigWins.id, id));
    await this.auditService.record({
      actorType: AuthRealm.TEAM,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'win.deleted',
      entityType: 'customer',
      entityId: win.customerId,
      before: { amount: win.amount, gameName: win.gameName },
      after: null,
      metadata: { winId: id },
    });
  }

  private staffQuery() {
    return this.db
      .select({
        id: bigWins.id,
        customerId: bigWins.customerId,
        fullName: customers.fullName,
        username: customers.username,
        avatarUrl: customers.avatarUrl,
        showInWins: customers.showInWins,
        gameName: games.name,
        amount: bigWins.amount,
        wonAt: bigWins.wonAt,
        hiddenAt: bigWins.hiddenAt,
        recorderFirst: staffUsers.firstName,
        recorderLast: staffUsers.lastName,
        recorderUsername: staffUsers.username,
      })
      .from(bigWins)
      .innerJoin(customers, eq(customers.id, bigWins.customerId))
      .leftJoin(games, eq(games.id, bigWins.gameId))
      .leftJoin(staffUsers, eq(staffUsers.id, bigWins.recordedByStaffId))
      .$dynamic();
  }

  private toStaff(
    row: Awaited<ReturnType<ReturnType<WinsService['staffQuery']>['execute']>>[number],
  ): WinDto {
    const recorder = [row.recorderFirst, row.recorderLast].filter(Boolean).join(' ');
    return {
      id: row.id,
      customerId: row.customerId,
      customerName: row.fullName || row.username,
      customerUsername: row.username,
      customerAvatarUrl: row.avatarUrl,
      customerShowsWins: row.showInWins,
      gameName: row.gameName,
      amount: row.amount,
      wonAt: row.wonAt,
      hidden: Boolean(row.hiddenAt),
      recordedBy: recorder || row.recorderUsername || null,
    };
  }

  private async requireWin(actor: ICurrentStaff, id: string): Promise<WinDto> {
    const scope = await this.scopeService.customerScope(actor);
    const [row] = await this.staffQuery()
      .where(and(eq(bigWins.id, id), isNull(customers.deletedAt), scope))
      .limit(1);
    if (!row) throw new ResourceNotFoundException(ErrorCode.NOT_FOUND, 'Win not found');
    return this.toStaff(row);
  }

  // ── Players ──────────────────────────────────────────────────

  private feedQuery(extra: SQL) {
    return this.db
      .select({
        id: bigWins.id,
        customerId: bigWins.customerId,
        fullName: customers.fullName,
        username: customers.username,
        gameName: games.name,
        gameImageUrl: games.imageUrl,
        amount: bigWins.amount,
        wonAt: bigWins.wonAt,
      })
      .from(bigWins)
      .innerJoin(customers, eq(customers.id, bigWins.customerId))
      .leftJoin(games, eq(games.id, bigWins.gameId))
      .where(
        and(
          isNull(bigWins.hiddenAt),
          isNull(customers.deletedAt),
          eq(customers.showInWins, true),
          sql`${bigWins.wonAt} <= now()`,
          extra,
        ),
      )
      .$dynamic();
  }

  async feed(customerId: string): Promise<WinFeedDto> {
    const [recent, top, [me]] = await Promise.all([
      this.feedQuery(sql`${bigWins.wonAt} > now() - interval '30 days'`)
        .orderBy(desc(bigWins.wonAt))
        .limit(30),
      this.feedQuery(sql`${bigWins.wonAt} > now() - interval '7 days'`)
        .orderBy(desc(bigWins.amount), desc(bigWins.wonAt))
        .limit(10),
      this.db
        .select({ show: customers.showInWins })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1),
    ]);
    const toItem = (row: (typeof recent)[number]): WinFeedItemDto => ({
      id: row.id,
      displayName: publicName(row.fullName, row.username),
      gameName: row.gameName,
      gameImageUrl: row.gameImageUrl,
      amount: row.amount,
      wonAt: row.wonAt,
      mine: row.customerId === customerId,
    });
    return { recent: recent.map(toItem), topThisWeek: top.map(toItem), showMine: me?.show ?? true };
  }

  async setVisibility(customerId: string, show: boolean): Promise<void> {
    await this.db.update(customers).set({ showInWins: show }).where(eq(customers.id, customerId));
  }

  /** Tells open player apps about a win, if it may be shown. */
  private async announce(id: string): Promise<void> {
    const [row] = await this.feedQuery(eq(bigWins.id, id)).limit(1);
    // A win dated more than a day back is history, not news.
    if (!row || Date.now() - row.wonAt.getTime() > 86_400_000) return;
    this.events.emit(
      WIN_RECORDED,
      new WinRecordedEvent({
        id: row.id,
        displayName: publicName(row.fullName, row.username),
        gameName: row.gameName,
        gameImageUrl: row.gameImageUrl,
        amount: row.amount,
        wonAt: row.wonAt,
      }),
    );
  }
}
