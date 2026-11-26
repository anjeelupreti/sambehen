import { sql, type SQL } from 'drizzle-orm';

/*
 * Columns are written out with their table name on purpose: these snippets
 * are dropped into queries and subqueries over other tables (transactions,
 * VIP qualifications) that have their own "id", and Drizzle prints a bare
 * column name when a query has a single table, which Postgres then reads
 * as the inner table's column.
 */
const CUSTOMER_ID = sql.raw('"customers"."id"');
const REGISTERED_AT = sql.raw('"customers"."registered_at"');
const LAST_ACTIVITY_AT = sql.raw('"customers"."last_activity_at"');

/**
 * Labels the system works out from a player's record. They are computed
 * when asked for, never stored, so they can't drift from the data.
 */
export enum AutoLabel {
  NEW = 'new',
  VIP = 'vip',
  BIG_SPENDER = 'big_spender',
  INACTIVE = 'inactive',
}

/** Joined within this many days. */
export const NEW_PLAYER_DAYS = 14;
/** No recorded activity for this many days. */
export const INACTIVE_DAYS = 30;
/** Money in is summed over this window for "big spender". */
export const SPEND_WINDOW_DAYS = 30;
/** Big spenders are the top 10% by money in, among the players the viewer can see. */
export const BIG_SPENDER_PERCENTILE = 0.9;

/** Holds a VIP tier in a criteria that is active today. */
export const isVipSql: SQL<boolean> = sql<boolean>`EXISTS (
  SELECT 1 FROM vip_qualifications q
  JOIN vip_criteria c ON c.id = q.criteria_id
  WHERE q.customer_id = ${CUSTOMER_ID}
    AND c.is_active AND c.deleted_at IS NULL
    AND CURRENT_DATE BETWEEN c.period_start AND c.period_end
)`;

export const isNewSql: SQL<boolean> = sql<boolean>`(${REGISTERED_AT} >= now() - make_interval(days => ${NEW_PLAYER_DAYS}))`;

export const isInactiveSql: SQL<boolean> = sql<boolean>`(${LAST_ACTIVITY_AT} IS NULL
  OR ${LAST_ACTIVITY_AT} < now() - make_interval(days => ${INACTIVE_DAYS}))`;

/** Money in over the spend window: debits that aren't corrections. */
export const recentSpendSql: SQL<string> = sql<string>`(
  SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
  WHERE t.customer_id = ${CUSTOMER_ID}
    AND t.type = 'debit'
    AND t.parent_transaction_id IS NULL
    AND t.deleted_at IS NULL
    AND t.occurred_at >= now() - make_interval(days => ${SPEND_WINDOW_DAYS})
)`;

/** "Big spender" against a threshold worked out for the viewer's scope. */
export const isBigSpenderSql = (threshold: number): SQL<boolean> =>
  sql<boolean>`(${threshold}::numeric > 0 AND ${recentSpendSql} >= ${threshold}::numeric)`;
