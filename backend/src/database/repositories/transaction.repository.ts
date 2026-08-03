import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database.provider';
import { transactions, Transaction } from '../schema/transactions.schema';
import { BaseRepository } from './base.repository';
import { TransactionType } from '@common/constants/app.constants';

/** Per-customer money aggregates. All values are decimal strings. */
export interface ICustomerTotals {
  customerId: string;
  totalTransactions: number;
  totalSpent: string;
  totalWithdrawn: string;
  totalCorrections: string;
  netBalance: string;
  lastTransactionAt: Date | null;
}

/** Aggregates for a filtered transaction list. */
export interface ITransactionTotals {
  totalCount: number;
  totalIn: string;
  totalOut: string;
  net: string;
  correctionCount: number;
  correctionTotal: string;
}

@Injectable()
export class TransactionRepository extends BaseRepository<typeof transactions> {
  constructor(@Inject(DRIZZLE_PROVIDER) db: DrizzleDB) {
    super(db, transactions);
  }

  get searchColumns(): PgColumn[] {
    return [transactions.referenceNo, transactions.note, transactions.channel];
  }

  get sortableColumns(): Record<string, PgColumn> {
    return {
      amount: transactions.amount,
      type: transactions.type,
      status: transactions.status,
      occurredAt: transactions.occurredAt,
      createdAt: transactions.createdAt,
    };
  }

  /**
   * Money aggregates for a set of customers, in one query.
   *
   * The distinction that matters:
   *   totalWithdrawn — credits with NO parent. Money the customer took.
   *   totalCorrections — credits WITH a parent. Bookkeeping fixes.
   *
   * Counting corrections as withdrawals is the easiest way to misreport
   * what a customer actually received, so the two are separated here once
   * and never re-derived by callers.
   */
  async totalsForCustomers(customerIds: string[]): Promise<Map<string, ICustomerTotals>> {
    if (customerIds.length === 0) return new Map();

    const rows = await this.db
      .select({
        customerId: transactions.customerId,
        totalTransactions: sql<number>`count(*)`,
        totalSpent: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'debit'
        ), 0)::text`,
        totalWithdrawn: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'credit'
            AND ${transactions.parentTransactionId} IS NULL
        ), 0)::text`,
        totalCorrections: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'credit'
            AND ${transactions.parentTransactionId} IS NOT NULL
        ), 0)::text`,
        netBalance: sql<string>`(
          COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type} = 'debit'), 0)
          - COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type} = 'credit'), 0)
        )::text`,
        lastTransactionAt: sql<Date | null>`MAX(${transactions.occurredAt})`,
      })
      .from(transactions)
      .where(and(isNull(transactions.deletedAt), inArray(transactions.customerId, customerIds)))
      .groupBy(transactions.customerId);

    return new Map(rows.map((row) => [row.customerId, row as ICustomerTotals]));
  }

  /**
   * Aggregates over a filtered transaction set.
   *
   * A second query against the list's own WHERE clause, so the summary
   * describes the whole result rather than the current page.
   */
  async totals(conditions: SQL[]): Promise<ITransactionTotals> {
    const [row] = await this.db
      .select({
        totalCount: sql<number>`count(*)`,
        totalIn: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'debit'
        ), 0)::text`,
        totalOut: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.type} = 'credit'
        ), 0)::text`,
        net: sql<string>`(
          COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type} = 'debit'), 0)
          - COALESCE(SUM(${transactions.amount}) FILTER (WHERE ${transactions.type} = 'credit'), 0)
        )::text`,
        correctionCount: sql<number>`count(*) FILTER (
          WHERE ${transactions.parentTransactionId} IS NOT NULL
        )`,
        correctionTotal: sql<string>`COALESCE(SUM(${transactions.amount}) FILTER (
          WHERE ${transactions.parentTransactionId} IS NOT NULL
        ), 0)::text`,
      })
      .from(transactions)
      .where(and(...conditions));

    return {
      totalCount: Number(row?.totalCount ?? 0),
      totalIn: row?.totalIn ?? '0',
      totalOut: row?.totalOut ?? '0',
      net: row?.net ?? '0',
      correctionCount: Number(row?.correctionCount ?? 0),
      correctionTotal: row?.correctionTotal ?? '0',
    };
  }

  /**
   * Total already corrected against a transaction.
   *
   * Used to cap a new correction: corrections must never exceed the parent
   * amount in aggregate, or the "fix" would create money that was never
   * taken.
   */
  async correctedTotal(parentTransactionId: string): Promise<string> {
    const [row] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.parentTransactionId, parentTransactionId),
          isNull(transactions.deletedAt),
        ),
      );

    return row?.total ?? '0';
  }

  async findCorrections(parentTransactionId: string): Promise<Transaction[]> {
    return this.findAll([eq(transactions.parentTransactionId, parentTransactionId)]);
  }

  /** Top games by money moved in the given direction. */
  async topGames(
    conditions: SQL[],
    type: TransactionType,
    limit = 5,
  ): Promise<{ gameId: string | null; total: string; transactionCount: number }[]> {
    return this.db
      .select({
        gameId: transactions.gameId,
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)::text`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(and(...conditions, eq(transactions.type, type)))
      .groupBy(transactions.gameId)
      .orderBy(sql`SUM(${transactions.amount}) DESC`)
      .limit(limit);
  }
}
