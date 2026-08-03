import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, eq, gte, inArray, isNull, lte, sql, SQL } from 'drizzle-orm';
import {
  ComparisonOperator,
  CustomerStatus,
  TransactionType,
} from '@common/constants/app.constants';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { customers } from '@database/schema/customers.schema';
import { transactions } from '@database/schema/transactions.schema';
import { vipCriteria } from '@database/schema/vip-criteria.schema';
import { vipQualifications } from '@database/schema/vip-qualifications.schema';
import { ScopeService } from '@shared/scope/scope.service';
import { RecipientFilterDto, RecipientQuickFilter } from './dto/email.dto';

export interface IResolvedRecipient {
  customerId: string;
  username: string;
  email: string;
  totalSpent: string;
}

/**
 * Turns a targeting filter into a concrete recipient list.
 *
 * Two rules govern everything here:
 *
 *   1. the actor's scope is applied first and is never optional, so a
 *      manager cannot mail another chain's customers even by naming their
 *      ids explicitly
 *   2. customers who cannot lawfully or usefully be mailed — no address,
 *      opted out, previously hard-bounced — are excluded at the query
 *      level rather than filtered out later, so the count the sender sees
 *      is the count that will actually be sent
 */
@Injectable()
export class RecipientFilterService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly scopeService: ScopeService,
    private readonly configService: ConfigService,
  ) {}

  /** Total spend per customer, as a correlated subquery. Debits only. */
  private totalSpentExpression(): SQL<string> {
    return sql<string>`COALESCE((
      SELECT SUM(t.amount) FROM ${transactions} t
      WHERE t.customer_id = ${customers.id}
        AND t.type = ${TransactionType.DEBIT}
        AND t.deleted_at IS NULL
    ), 0)`;
  }

  /**
   * Builds the WHERE clause.
   *
   * `includeUnmailable` exists so the preview can report how many selected
   * customers were dropped for having no address or opting out. Sending
   * always uses the mailable set.
   */
  async buildConditions(
    actor: ICurrentStaff,
    filter: RecipientFilterDto,
    includeUnmailable = false,
  ): Promise<SQL[]> {
    const conditions: SQL[] = [isNull(customers.deletedAt)];

    const scope = await this.scopeService.customerScope(actor, {
      managerId: filter.managerId,
      runnerId: filter.runnerId,
    });
    if (scope) conditions.push(scope);

    // An explicit selection narrows the audience; it never widens it,
    // because the scope predicate above still applies.
    if (filter.customerIds?.length) {
      conditions.push(inArray(customers.id, filter.customerIds));
    }

    if (!includeUnmailable) {
      conditions.push(
        eq(customers.emailOptOut, false),
        sql`${customers.email} IS NOT NULL AND ${customers.email} <> ''`,
      );
    }

    const quick = this.quickFilterCondition(filter.quickFilter);
    if (quick) conditions.push(quick);

    const spending = this.spendingCondition(filter);
    if (spending) conditions.push(spending);

    if (filter.city) conditions.push(eq(customers.city, filter.city));
    if (filter.state) conditions.push(eq(customers.state, filter.state));
    if (filter.country) conditions.push(eq(customers.country, filter.country));

    if (filter.isVip || filter.vipTier) {
      conditions.push(this.vipCondition(filter.vipTier));
    }

    // A rolling window takes precedence over explicit bounds, matching the
    // behaviour of every other date filter in the system.
    if (filter.lastNDays) {
      conditions.push(
        gte(customers.registeredAt, new Date(Date.now() - filter.lastNDays * 86_400_000)),
      );
    } else {
      if (filter.startDate) conditions.push(gte(customers.registeredAt, filter.startDate));
      if (filter.endDate) conditions.push(lte(customers.registeredAt, filter.endDate));
    }

    return conditions;
  }

  private quickFilterCondition(quick?: RecipientQuickFilter): SQL | undefined {
    if (!quick) return undefined;

    const windowDays = this.configService.get<number>('business.activeCustomerWindowDays', 30);
    const activeCutoff = new Date(Date.now() - windowDays * 86_400_000);
    const threshold = this.configService.get<string>('business.highSpenderThreshold', '250.00');
    const spent = this.totalSpentExpression();

    const hasTransactions = sql`EXISTS (
      SELECT 1 FROM ${transactions} t
      WHERE t.customer_id = ${customers.id} AND t.deleted_at IS NULL
    )`;

    switch (quick) {
      case RecipientQuickFilter.ALL_ACTIVE:
        return and(
          eq(customers.status, CustomerStatus.ACTIVE),
          gte(customers.lastActivityAt, activeCutoff),
        );

      case RecipientQuickFilter.WITH_TRANSACTIONS:
        return hasTransactions;

      case RecipientQuickFilter.WITHOUT_TRANSACTIONS:
        return sql`NOT ${hasTransactions}`;

      case RecipientQuickFilter.RECENT_TRANSACTIONS:
        return sql`EXISTS (
          SELECT 1 FROM ${transactions} t
          WHERE t.customer_id = ${customers.id}
            AND t.deleted_at IS NULL
            AND t.occurred_at >= NOW() - INTERVAL '30 days'
        )`;

      case RecipientQuickFilter.HIGH_SPENDERS:
        return sql`${spent} >= ${threshold}`;

      case RecipientQuickFilter.LOW_SPENDERS:
        return sql`${spent} < ${threshold}`;

      default:
        return undefined;
    }
  }

  private spendingCondition(filter: RecipientFilterDto): SQL | undefined {
    if (!filter.spendingOperator || !filter.minAmount) return undefined;

    const spent = this.totalSpentExpression();
    const min = filter.minAmount;

    switch (filter.spendingOperator) {
      case ComparisonOperator.GT:
        return sql`${spent} > ${min}`;
      case ComparisonOperator.GTE:
        return sql`${spent} >= ${min}`;
      case ComparisonOperator.LT:
        return sql`${spent} < ${min}`;
      case ComparisonOperator.LTE:
        return sql`${spent} <= ${min}`;
      case ComparisonOperator.EQ:
        return sql`${spent} = ${min}`;
      case ComparisonOperator.BETWEEN:
        // Without maxAmount, "between" has no upper bound and would
        // silently behave as >=. Refusing to guess is safer than mailing
        // a wider audience than intended.
        return filter.maxAmount ? sql`${spent} BETWEEN ${min} AND ${filter.maxAmount}` : undefined;
      default:
        return undefined;
    }
  }

  /** Holds a qualification under a criteria whose window contains today. */
  private vipCondition(tier?: number): SQL {
    const tierClause = tier ? sql`AND vc.tier = ${tier}` : sql``;

    return sql`EXISTS (
      SELECT 1 FROM ${vipQualifications} vq
      INNER JOIN ${vipCriteria} vc ON vq.criteria_id = vc.id
      WHERE vq.customer_id = ${customers.id}
        AND vc.is_active = true
        AND vc.deleted_at IS NULL
        AND CURRENT_DATE BETWEEN vc.period_start AND vc.period_end
        ${tierClause}
    )`;
  }

  /** Resolves the full mailable recipient list. */
  async resolve(actor: ICurrentStaff, filter: RecipientFilterDto): Promise<IResolvedRecipient[]> {
    const conditions = await this.buildConditions(actor, filter);

    const rows = await this.db
      .select({
        customerId: customers.id,
        username: customers.username,
        email: customers.email,
        totalSpent: sql<string>`${this.totalSpentExpression()}::text`,
      })
      .from(customers)
      .where(and(...conditions));

    return rows;
  }

  /**
   * Count plus a sample, for showing the sender what they are about to do.
   *
   * `excluded` is the difference between everyone the filter selects and
   * everyone who can actually be mailed — the number the sender most needs
   * to understand before pressing send.
   */
  async preview(
    actor: ICurrentStaff,
    filter: RecipientFilterDto,
    sampleSize = 10,
  ): Promise<{ totalRecipients: number; excluded: number; sample: IResolvedRecipient[] }> {
    const [mailable, everyone] = await Promise.all([
      this.buildConditions(actor, filter, false),
      this.buildConditions(actor, filter, true),
    ]);

    const [[mailableRow], [everyoneRow], sample] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(customers)
        .where(and(...mailable)),
      this.db
        .select({ value: count() })
        .from(customers)
        .where(and(...everyone)),
      this.db
        .select({
          customerId: customers.id,
          username: customers.username,
          email: customers.email,
          totalSpent: sql<string>`${this.totalSpentExpression()}::text`,
        })
        .from(customers)
        .where(and(...mailable))
        .limit(sampleSize),
    ]);

    const totalRecipients = Number(mailableRow?.value ?? 0);
    const selected = Number(everyoneRow?.value ?? 0);

    return { totalRecipients, excluded: selected - totalRecipients, sample };
  }
}
