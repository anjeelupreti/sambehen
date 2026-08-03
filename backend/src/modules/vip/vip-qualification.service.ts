import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { and, eq, sql } from 'drizzle-orm';
import { VipMetric } from '@common/constants/app.constants';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { vipCriteria, VipCriteria } from '@database/schema/vip-criteria.schema';
import { transactions } from '@database/schema/transactions.schema';
import {
  TRANSACTION_CREATED,
  TransactionCreatedEvent,
} from '@modules/transactions/transactions.service';

/**
 * Decides who qualifies for which VIP criteria, and keeps
 * `vip_qualifications` in step with the transaction ledger.
 *
 * Recompute is expressed as one INSERT ... SELECT ... ON CONFLICT, so
 * rebuilding an entire criteria is a single statement rather than a loop
 * over customers. That matters because a threshold change invalidates
 * every row for that criteria at once.
 */
@Injectable()
export class VipQualificationService {
  private readonly logger = new Logger(VipQualificationService.name);

  constructor(@Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB) {}

  /**
   * The SQL expression for a criteria's metric.
   *
   * total_debit counts money in and deliberately ignores credits, so a
   * withdrawal does not reduce the standing a customer has already earned.
   * net subtracts credits, including corrections, because a corrected
   * entry never really happened.
   */
  private metricExpression(metric: VipMetric): ReturnType<typeof sql> {
    switch (metric) {
      case VipMetric.TOTAL_DEBIT:
        return sql`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'debit'
        ), 0)`;

      case VipMetric.NET:
        return sql`(
          COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type} = 'debit'), 0)
          - COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type} = 'credit'), 0)
        )`;

      case VipMetric.TRANSACTION_COUNT:
        return sql`COUNT(*)`;

      default:
        return sql`0`;
    }
  }

  /**
   * Rebuilds every qualification for one criteria.
   *
   * Runs as a single statement: aggregate the ledger inside the criteria
   * window, keep the customers at or above the threshold, and upsert.
   * Customers who no longer reach it are deleted afterwards, so lowering
   * a threshold adds VIPs and raising it removes them without leaving
   * stale rows behind.
   */
  async recomputeCriteria(criteria: VipCriteria): Promise<{ qualified: number; removed: number }> {
    const metric = this.metricExpression(criteria.metric);

    // Watermark taken before the upsert. Every row the upsert touches gets
    // computed_at = NOW(), which is strictly later, so the cleanup below
    // can identify stale rows without depending on how long the recompute
    // took — a fixed interval would delete freshly written rows on a slow
    // run.
    const startedAt = new Date();

    const inserted = await this.db.execute(sql`
      INSERT INTO vip_qualifications (criteria_id, customer_id, achieved_amount, threshold_amount, qualified_at, computed_at)
      SELECT
        ${criteria.id}::uuid,
        ${transactions.customerId},
        ${metric},
        ${criteria.thresholdAmount},
        NOW(),
        NOW()
      FROM ${transactions}
      WHERE ${transactions.deletedAt} IS NULL
        AND ${transactions.occurredAt}::date >= ${criteria.periodStart}::date
        AND ${transactions.occurredAt}::date <= ${criteria.periodEnd}::date
      GROUP BY ${transactions.customerId}
      HAVING ${metric} >= ${criteria.thresholdAmount}
      ON CONFLICT (criteria_id, customer_id) DO UPDATE SET
        achieved_amount = EXCLUDED.achieved_amount,
        threshold_amount = EXCLUDED.threshold_amount,
        computed_at = NOW()
      RETURNING customer_id
    `);

    // Anything still recorded but no longer meeting the bar. Comparing
    // against the watermark avoids a second aggregate: rows the upsert
    // just touched carry a later timestamp, so whatever it did not touch
    // no longer qualifies.
    const removed = await this.db.execute(sql`
      DELETE FROM vip_qualifications
      WHERE criteria_id = ${criteria.id}::uuid
        AND computed_at < ${startedAt.toISOString()}::timestamptz
      RETURNING customer_id
    `);

    const result = {
      qualified: inserted.rowCount ?? 0,
      removed: removed.rowCount ?? 0,
    };

    this.logger.log(
      `Recomputed VIP criteria "${criteria.name}": ${result.qualified} qualified, ${result.removed} removed`,
    );
    return result;
  }

  /**
   * Re-evaluates one customer against every criteria whose window covers
   * the given date.
   *
   * Cheaper than a full recompute and enough for the common case: a new
   * transaction can only change that customer's standing, and only for
   * windows containing the date it occurred on.
   */
  async evaluateCustomer(customerId: string, occurredAt: Date): Promise<number> {
    const occurredDate = occurredAt.toISOString().slice(0, 10);

    const relevant = await this.db
      .select()
      .from(vipCriteria)
      .where(
        and(
          eq(vipCriteria.isActive, true),
          sql`${vipCriteria.periodStart} <= ${occurredDate}::date`,
          sql`${vipCriteria.periodEnd} >= ${occurredDate}::date`,
          sql`${vipCriteria.deletedAt} IS NULL`,
        ),
      );

    let touched = 0;
    for (const criteria of relevant) {
      const metric = this.metricExpression(criteria.metric);

      await this.db.execute(sql`
        INSERT INTO vip_qualifications (criteria_id, customer_id, achieved_amount, threshold_amount, qualified_at, computed_at)
        SELECT
          ${criteria.id}::uuid,
          ${customerId}::uuid,
          ${metric},
          ${criteria.thresholdAmount},
          NOW(),
          NOW()
        FROM ${transactions}
        WHERE ${transactions.customerId} = ${customerId}::uuid
          AND ${transactions.deletedAt} IS NULL
          AND ${transactions.occurredAt}::date >= ${criteria.periodStart}::date
          AND ${transactions.occurredAt}::date <= ${criteria.periodEnd}::date
        HAVING ${metric} >= ${criteria.thresholdAmount}
        ON CONFLICT (criteria_id, customer_id) DO UPDATE SET
          achieved_amount = EXCLUDED.achieved_amount,
          threshold_amount = EXCLUDED.threshold_amount,
          computed_at = NOW()
      `);
      touched += 1;
    }

    return touched;
  }

  /**
   * Reacts to new transactions.
   *
   * Deliberately swallows its errors: VIP standing is derived data, and
   * failing to update it must never fail the transaction entry that staff
   * just performed. A nightly recompute repairs whatever this misses.
   */
  @OnEvent(TRANSACTION_CREATED, { async: true })
  async handleTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    try {
      await this.evaluateCustomer(event.customerId, event.occurredAt);
    } catch (error) {
      this.logger.error(
        `Failed to re-evaluate VIP status for customer ${event.customerId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Progress towards a criteria for one customer, whether or not they
   * qualify. Powers the customer's own status page, where showing "820 of
   * 1000" is the point.
   */
  async progressFor(
    customerId: string,
    criteria: VipCriteria,
  ): Promise<{ achieved: string; threshold: string; percent: number; qualified: boolean }> {
    const metric = this.metricExpression(criteria.metric);

    const rows = await this.db
      .select({ achieved: sql<string>`${metric}::text` })
      .from(transactions)
      .where(
        and(
          eq(transactions.customerId, customerId),
          sql`${transactions.deletedAt} IS NULL`,
          sql`${transactions.occurredAt}::date >= ${criteria.periodStart}::date`,
          sql`${transactions.occurredAt}::date <= ${criteria.periodEnd}::date`,
        ),
      );

    const achieved = rows[0]?.achieved ?? '0';
    const achievedNumber = Number(achieved);
    const thresholdNumber = Number(criteria.thresholdAmount);

    return {
      achieved,
      threshold: criteria.thresholdAmount,
      // Capped at 100: a customer far past the bar does not need a 340%
      // progress bar, and clients would have to clamp it anyway.
      percent:
        thresholdNumber > 0
          ? Math.min(100, Math.round((achievedNumber / thresholdNumber) * 100))
          : 0,
      qualified: achievedNumber >= thresholdNumber,
    };
  }
}
