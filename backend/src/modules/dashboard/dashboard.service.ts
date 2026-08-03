import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, eq, inArray, isNull, sql, SQL } from 'drizzle-orm';
import {
  CustomerStatus,
  MessageSenderType,
  StaffRole,
  TransactionType,
} from '@common/constants/app.constants';
import { Money } from '@common/utils/money.util';
import { HashUtil } from '@common/utils/hash.util';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { staffUsers } from '@database/schema/staff-users.schema';
import { transactions } from '@database/schema/transactions.schema';
import { games } from '@database/schema/games.schema';
import { vipCriteria } from '@database/schema/vip-criteria.schema';
import { vipQualifications } from '@database/schema/vip-qualifications.schema';
import { conversations, messages, conversationReadStates } from '@database/schema/messaging.schema';
import { spinWinners } from '@database/schema/spin-events.schema';
import { ScopeService } from '@shared/scope/scope.service';
import { CacheService } from '@shared/cache/cache.service';
import {
  DashboardFilterDto,
  TrendQueryDto,
  TrendGranularity,
  DashboardResponseDto,
  TrendResponseDto,
  NetPositionDto,
  MonthlyNetDto,
  TopGameDto,
  CustomerMetricsDto,
  VipMetricsDto,
  MessagingMetricsDto,
  TeamRollupRowDto,
  CustomerDashboardDto,
} from './dto/dashboard.dto';

/** Dashboards tolerate slightly stale numbers; queries here are the heaviest in the system. */
const CACHE_TTL_SECONDS = 90;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly scopeService: ScopeService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * The full staff dashboard.
   *
   * Every figure is scoped: a runner sees their own customers, a manager
   * their chain, a master the business. The scope predicate is resolved
   * once and reused across all the aggregates, so no metric can be
   * computed against a different visibility than its neighbours.
   *
   * Cached per actor and filter. The key includes the actor id, so one
   * user's dashboard can never be served to another — a shared cache key
   * here would be a cross-tenant leak rather than merely a stale number.
   */
  async getDashboard(
    actor: ICurrentStaff,
    filters: DashboardFilterDto,
  ): Promise<DashboardResponseDto> {
    const cacheKey = this.cacheKey('dashboard', actor, filters);
    const cached = await this.cacheService.get<DashboardResponseDto>(cacheKey);
    if (cached) return cached;

    const scope = await this.scopeService.customerScope(actor, filters);
    // Transactions, conversations and VIP rows are all reached through
    // their customer, so one subquery serves every aggregate below.
    const customerIds = scope
      ? sql`(SELECT ${customers.id} FROM ${customers} WHERE ${scope} AND ${customers.deletedAt} IS NULL)`
      : sql`(SELECT ${customers.id} FROM ${customers} WHERE ${customers.deletedAt} IS NULL)`;

    const [allTime, thisMonth, topDebit, topCredit, customerMetrics, vips, messaging, teamRollup] =
      await Promise.all([
        this.netPosition(customerIds),
        this.monthlyNet(customerIds),
        this.topGames(customerIds, TransactionType.DEBIT),
        this.topGames(customerIds, TransactionType.CREDIT),
        this.customerMetrics(scope),
        this.vipMetrics(customerIds),
        this.messagingMetrics(actor, customerIds),
        this.teamRollup(actor),
      ]);

    const result: DashboardResponseDto = {
      scope: actor.role,
      allTime,
      thisMonth,
      topGamesByDebit: topDebit,
      topGamesByCredit: topCredit,
      customers: customerMetrics,
      vips,
      messaging,
      teamRollup,
      generatedAt: new Date(),
    };

    await this.cacheService.set(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  /** All-time in / out / balance. */
  private async netPosition(customerIds: SQL, extra?: SQL): Promise<NetPositionDto> {
    const conditions = [
      sql`${transactions.customerId} IN ${customerIds}`,
      isNull(transactions.deletedAt),
    ];
    if (extra) conditions.push(extra);

    const [row] = await this.db
      .select({
        totalIn: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'debit'
        ), 0)::text`,
        totalOut: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'credit'
        ), 0)::text`,
        transactionCount: count(),
      })
      .from(transactions)
      .where(and(...conditions));

    const totalIn = row?.totalIn ?? '0';
    const totalOut = row?.totalOut ?? '0';

    return {
      totalIn,
      totalOut,
      balance: Money.subtract(totalIn, totalOut),
      transactionCount: Number(row?.transactionCount ?? 0),
    };
  }

  /**
   * This calendar month, with the change against last month.
   *
   * Both months come from one query rather than two round trips, and the
   * percentage is null when the previous month was zero: a change from
   * nothing is undefined, not infinite, and reporting it as such stops the
   * frontend rendering "Infinity%".
   */
  private async monthlyNet(customerIds: SQL): Promise<MonthlyNetDto> {
    const [row] = await this.db
      .select({
        currentIn: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'debit'
            AND ${transactions.occurredAt} >= date_trunc('month', CURRENT_DATE)
        ), 0)::text`,
        currentOut: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'credit'
            AND ${transactions.occurredAt} >= date_trunc('month', CURRENT_DATE)
        ), 0)::text`,
        currentCount: sql<number>`COUNT(*) FILTER (
          WHERE ${transactions.occurredAt} >= date_trunc('month', CURRENT_DATE)
        )`,
        previousIn: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'debit'
            AND ${transactions.occurredAt} >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND ${transactions.occurredAt} < date_trunc('month', CURRENT_DATE)
        ), 0)::text`,
        previousOut: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'credit'
            AND ${transactions.occurredAt} >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND ${transactions.occurredAt} < date_trunc('month', CURRENT_DATE)
        ), 0)::text`,
      })
      .from(transactions)
      .where(
        and(sql`${transactions.customerId} IN ${customerIds}`, isNull(transactions.deletedAt)),
      );

    const totalIn = row?.currentIn ?? '0';
    const totalOut = row?.currentOut ?? '0';
    const balance = Money.subtract(totalIn, totalOut);
    const previousBalance = Money.subtract(row?.previousIn ?? '0', row?.previousOut ?? '0');

    const previousNumber = Number(previousBalance);
    const changePercent =
      previousNumber === 0
        ? null
        : Math.round(((Number(balance) - previousNumber) / Math.abs(previousNumber)) * 1000) / 10;

    return {
      totalIn,
      totalOut,
      balance,
      transactionCount: Number(row?.currentCount ?? 0),
      changePercent,
      previousBalance,
    };
  }

  /**
   * Highest-grossing games in one direction.
   *
   * Debit and credit are ranked separately because they answer different
   * questions: which game brings money in, and which pays money out.
   */
  private async topGames(
    customerIds: SQL,
    type: TransactionType,
    limit = 5,
  ): Promise<TopGameDto[]> {
    const rows = await this.db
      .select({
        gameId: transactions.gameId,
        gameName: games.name,
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
        transactionCount: count(),
      })
      .from(transactions)
      .leftJoin(games, eq(transactions.gameId, games.id))
      .where(
        and(
          sql`${transactions.customerId} IN ${customerIds}`,
          isNull(transactions.deletedAt),
          eq(transactions.type, type),
        ),
      )
      .groupBy(transactions.gameId, games.name)
      .orderBy(sql`SUM(${transactions.amount}) DESC`)
      .limit(limit);

    return rows.map((row) => ({ ...row, transactionCount: Number(row.transactionCount) }));
  }

  private async customerMetrics(scope: SQL | undefined): Promise<CustomerMetricsDto> {
    const windowDays = this.configService.get<number>('business.activeCustomerWindowDays', 30);
    const cutoff = new Date(Date.now() - windowDays * 86_400_000);

    const conditions: SQL[] = [isNull(customers.deletedAt)];
    if (scope) conditions.push(scope);

    const [row] = await this.db
      .select({
        total: count(),
        active: sql<number>`COUNT(*) FILTER (
          WHERE ${customers.status} = ${CustomerStatus.ACTIVE}
            AND ${customers.lastActivityAt} >= ${cutoff}
        )`,
        inactive: sql<number>`COUNT(*) FILTER (
          WHERE ${customers.status} <> ${CustomerStatus.ACTIVE}
             OR ${customers.lastActivityAt} IS NULL
             OR ${customers.lastActivityAt} < ${cutoff}
        )`,
        newThisMonth: sql<number>`COUNT(*) FILTER (
          WHERE ${customers.registeredAt} >= date_trunc('month', CURRENT_DATE)
        )`,
      })
      .from(customers)
      .where(and(...conditions));

    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
      newThisMonth: Number(row?.newThisMonth ?? 0),
    };
  }

  /** VIPs under a criteria whose window contains today. */
  private async vipMetrics(customerIds: SQL): Promise<VipMetricsDto> {
    const rows = await this.db
      .select({ tier: vipCriteria.tier, value: count() })
      .from(vipQualifications)
      .innerJoin(vipCriteria, eq(vipQualifications.criteriaId, vipCriteria.id))
      .where(
        and(
          sql`${vipQualifications.customerId} IN ${customerIds}`,
          eq(vipCriteria.isActive, true),
          isNull(vipCriteria.deletedAt),
          sql`CURRENT_DATE BETWEEN ${vipCriteria.periodStart} AND ${vipCriteria.periodEnd}`,
        ),
      )
      .groupBy(vipCriteria.tier)
      .orderBy(sql`${vipCriteria.tier} DESC`);

    const byTier = rows.map((row) => ({ tier: row.tier, count: Number(row.value) }));

    return {
      activeVips: byTier.reduce((sum, entry) => sum + entry.count, 0),
      byTier,
    };
  }

  /** Messaging counters, with unread computed for this viewer specifically. */
  private async messagingMetrics(
    actor: ICurrentStaff,
    customerIds: SQL,
  ): Promise<MessagingMetricsDto> {
    const [row] = await this.db
      .select({
        unreadMessages: sql<number>`COALESCE(SUM((
          SELECT COUNT(*) FROM ${messages} m
          WHERE m.conversation_id = ${conversations.id}
            AND m.sender_type = 'customer'
            AND m.deleted_at IS NULL
            AND m.created_at > COALESCE(
              (SELECT rs.last_read_at FROM ${conversationReadStates} rs
               WHERE rs.conversation_id = ${conversations.id} AND rs.staff_id = ${actor.id}::uuid),
              '-infinity'::timestamptz)
        )), 0)`,
        conversationsToday: sql<number>`COUNT(*) FILTER (
          WHERE ${conversations.lastMessageAt}::date = CURRENT_DATE
        )`,
        awaitingReply: sql<number>`COUNT(*) FILTER (
          WHERE ${conversations.lastCustomerMessageAt} IS NOT NULL
            AND (${conversations.lastStaffMessageAt} IS NULL
                 OR ${conversations.lastCustomerMessageAt} > ${conversations.lastStaffMessageAt})
        )`,
        responsesToday: sql<number>`(
          SELECT COUNT(*) FROM ${messages} m2
          INNER JOIN ${conversations} c2 ON m2.conversation_id = c2.id
          WHERE c2.customer_id IN ${customerIds}
            AND m2.sender_type = 'staff'
            AND m2.created_at::date = CURRENT_DATE
        )`,
      })
      .from(conversations)
      .where(sql`${conversations.customerId} IN ${customerIds}`);

    return {
      unreadMessages: Number(row?.unreadMessages ?? 0),
      conversationsToday: Number(row?.conversationsToday ?? 0),
      responsesToday: Number(row?.responsesToday ?? 0),
      awaitingReply: Number(row?.awaitingReply ?? 0),
    };
  }

  /**
   * Breakdown one level below the actor.
   *
   * A master sees per-manager totals, a manager sees per-runner. A runner
   * is a leaf and gets an empty array rather than a row for themselves,
   * which would just restate the headline figures.
   */
  private async teamRollup(actor: ICurrentStaff): Promise<TeamRollupRowDto[]> {
    if (actor.role === StaffRole.RUNNER) return [];

    const childRole = actor.role === StaffRole.MASTER ? StaffRole.MANAGER : StaffRole.RUNNER;

    const children = await this.db
      .select({ id: staffUsers.id, username: staffUsers.username, role: staffUsers.role })
      .from(staffUsers)
      .where(
        and(
          eq(staffUsers.role, childRole),
          isNull(staffUsers.deletedAt),
          actor.role === StaffRole.MASTER ? sql`true` : eq(staffUsers.parentId, actor.id),
        ),
      );

    if (children.length === 0) return [];

    // A manager's row aggregates their whole chain; a runner's row covers
    // only the customers they own directly.
    const ownershipColumn =
      childRole === StaffRole.MANAGER ? customers.managerId : customers.runnerId;

    const rows = await this.db
      .select({
        staffId: ownershipColumn,
        customerCount: sql<number>`COUNT(DISTINCT ${customers.id})`,
        totalIn: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'debit'
        ), 0)::text`,
        totalOut: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'credit'
        ), 0)::text`,
      })
      .from(customers)
      .leftJoin(
        transactions,
        and(eq(transactions.customerId, customers.id), isNull(transactions.deletedAt)),
      )
      .where(
        and(
          isNull(customers.deletedAt),
          inArray(
            ownershipColumn,
            children.map((child) => child.id),
          ),
        ),
      )
      .groupBy(ownershipColumn);

    const totals = new Map(rows.map((row) => [row.staffId, row]));

    return children.map((child) => {
      const row = totals.get(child.id);
      const totalIn = row?.totalIn ?? '0';
      const totalOut = row?.totalOut ?? '0';

      return {
        staffId: child.id,
        username: child.username,
        role: child.role,
        customerCount: Number(row?.customerCount ?? 0),
        totalIn,
        totalOut,
        balance: Money.subtract(totalIn, totalOut),
      };
    });
  }

  /**
   * Time-bucketed net series.
   *
   * generate_series produces every bucket in the range and the aggregate is
   * LEFT JOINed onto it, so a quiet day comes back as zero rather than
   * being missing. Omitting empty buckets makes a chart join across the
   * gap and imply activity that never happened.
   */
  async getTrends(actor: ICurrentStaff, query: TrendQueryDto): Promise<TrendResponseDto> {
    const cacheKey = this.cacheKey('trends', actor, query);
    const cached = await this.cacheService.get<TrendResponseDto>(cacheKey);
    if (cached) return cached;

    const scope = await this.scopeService.customerScope(actor, query);
    const customerIds = scope
      ? sql`(SELECT ${customers.id} FROM ${customers} WHERE ${scope} AND ${customers.deletedAt} IS NULL)`
      : sql`(SELECT ${customers.id} FROM ${customers} WHERE ${customers.deletedAt} IS NULL)`;

    const granularity = query.granularity ?? TrendGranularity.DAY;
    const to = query.dateTo ?? new Date();
    const from = query.dateFrom ?? new Date(to.getTime() - (query.lastNDays ?? 30) * 86_400_000);

    const rows = await this.db.execute(sql`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${granularity}, ${from.toISOString()}::timestamptz),
          date_trunc(${granularity}, ${to.toISOString()}::timestamptz),
          ${'1 ' + granularity}::interval
        ) AS bucket
      ),
      totals AS (
        SELECT
          date_trunc(${granularity}, t.occurred_at) AS bucket,
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'), 0) AS total_in,
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0) AS total_out,
          COUNT(*) AS transaction_count
        FROM ${transactions} t
        WHERE t.customer_id IN ${customerIds}
          AND t.deleted_at IS NULL
          AND t.occurred_at >= ${from.toISOString()}::timestamptz
          AND t.occurred_at <= ${to.toISOString()}::timestamptz
        GROUP BY 1
      )
      SELECT
        to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
        COALESCE(t.total_in, 0)::text AS total_in,
        COALESCE(t.total_out, 0)::text AS total_out,
        (COALESCE(t.total_in, 0) - COALESCE(t.total_out, 0))::text AS balance,
        COALESCE(t.transaction_count, 0)::int AS transaction_count
      FROM buckets b
      LEFT JOIN totals t ON t.bucket = b.bucket
      ORDER BY b.bucket
    `);

    const result: TrendResponseDto = {
      granularity,
      points: (rows.rows as Record<string, unknown>[]).map((row) => ({
        bucket: row.bucket as string,
        totalIn: row.total_in as string,
        totalOut: row.total_out as string,
        balance: row.balance as string,
        transactionCount: Number(row.transaction_count),
      })),
    };

    await this.cacheService.set(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  /** The customer's own overview. */
  async getCustomerDashboard(customerId: string): Promise<CustomerDashboardDto> {
    const [[customer], [totals], [vip], [unread], [wins]] = await Promise.all([
      this.db
        .select({ balance: customers.balance, bonusBalance: customers.bonusBalance })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1),
      this.db
        .select({
          totalSpent: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
            WHERE ${transactions.type} = 'debit'
          ), 0)::text`,
          // Corrections carry a parent, so excluding them is what makes
          // this "money the customer actually took out".
          totalWithdrawn: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
            WHERE ${transactions.type} = 'credit'
              AND ${transactions.parentTransactionId} IS NULL
          ), 0)::text`,
          transactionCount: count(),
        })
        .from(transactions)
        .where(and(eq(transactions.customerId, customerId), isNull(transactions.deletedAt))),
      this.db
        .select({ tier: sql<number>`MAX(${vipCriteria.tier})` })
        .from(vipQualifications)
        .innerJoin(vipCriteria, eq(vipQualifications.criteriaId, vipCriteria.id))
        .where(
          and(
            eq(vipQualifications.customerId, customerId),
            eq(vipCriteria.isActive, true),
            isNull(vipCriteria.deletedAt),
            sql`CURRENT_DATE BETWEEN ${vipCriteria.periodStart} AND ${vipCriteria.periodEnd}`,
          ),
        ),
      this.db
        .select({ value: count() })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(
          and(
            eq(conversations.customerId, customerId),
            eq(messages.senderType, MessageSenderType.STAFF),
            isNull(messages.deletedAt),
            sql`(${conversations.lastCustomerMessageAt} IS NULL
                 OR ${messages.createdAt} > ${conversations.lastCustomerMessageAt})`,
          ),
        ),
      this.db
        .select({ value: count() })
        .from(spinWinners)
        .where(eq(spinWinners.customerId, customerId)),
    ]);

    const tier = vip?.tier ?? null;

    return {
      balance: customer?.balance ?? '0.00',
      bonusBalance: customer?.bonusBalance ?? '0.00',
      totalSpent: totals?.totalSpent ?? '0',
      totalWithdrawn: totals?.totalWithdrawn ?? '0',
      transactionCount: Number(totals?.transactionCount ?? 0),
      isVip: tier !== null,
      vipTier: tier,
      unreadMessages: Number(unread?.value ?? 0),
      totalWins: Number(wins?.value ?? 0),
    };
  }

  /**
   * Cache key.
   *
   * The actor id is part of the key, not just the filters: two managers
   * requesting identical filters must never share an entry, or one would
   * be served the other's chain.
   */
  private cacheKey(prefix: string, actor: ICurrentStaff, filters: object): string {
    const fingerprint = HashUtil.sha256(JSON.stringify(filters)).slice(0, 16);
    return `dashboard:${prefix}:${actor.id}:${fingerprint}`;
  }
}
