/**
 * The API contract, typed by hand from the backend's OpenAPI document.
 *
 * Regenerate the source of truth with `npm run docs:openapi` in backend/
 * and reconcile anything that has drifted. These types are deliberately
 * narrow: money is `string` everywhere, never `number`.
 */

/** Every successful response carries this envelope. */
export interface ApiEnvelope<TData, TSummary = undefined> {
  success: true;
  statusCode: number;
  message: string;
  data: TData;
  meta?: PaginationMeta;
  summary?: TSummary;
  timestamp: string;
  path: string;
  correlationId: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Failures replace `data` with `error`. */
export interface ApiErrorEnvelope {
  success: false;
  statusCode: number;
  message: string;
  error: {
    code: string;
    message: string;
    details: ValidationDetail[] | Record<string, unknown> | null;
  };
  timestamp: string;
  path: string;
  correlationId: string;
}

export interface ValidationDetail {
  field: string;
  constraint: string;
  message: string;
}

/** A page of rows plus the totals that describe the whole filtered set. */
export interface Paginated<TRow, TSummary = undefined> {
  data: TRow[];
  meta: PaginationMeta;
  summary?: TSummary;
}

export type StaffRole = 'master' | 'manager' | 'runner';
export type CustomerStatus = 'active' | 'inactive' | 'suspended' | 'banned';
export type TransactionType = 'debit' | 'credit';

export interface Staff {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: StaffRole;
  parentId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Always `Bearer`. The API does not return a lifetime — read `exp` off the token. */
  tokenType: string;
}

/** The login payload's staff record: no `createdAt`, plus a password flag. */
export interface AuthenticatedStaff extends Omit<Staff, 'createdAt'> {
  mustChangePassword: boolean;
}

/**
 * The login payload.
 *
 * The staff record comes back as `user`, not `staff`, and there is no
 * `expiresIn` — the access token's own `exp` claim is the only statement of
 * its lifetime.
 */
export interface TeamLoginResponse extends AuthTokens {
  user: AuthenticatedStaff;
}

export interface Customer {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  status: CustomerStatus;
  managerUsername: string | null;
  runnerUsername: string | null;
  totalTransactions: number;
  /** Money. Strings, always — see lib/money.ts. */
  totalSpent: string;
  totalWithdrawn: string;
  totalCorrections: string;
  netBalance: string;
  balance: string;
  bonusBalance: string;
  lastActivityAt: string | null;
  registeredAt: string;
}

/**
 * Totals over the whole filtered set, not the current page.
 *
 * Note this summarises *balances*, not lifetime spend — there is no
 * spent/withdrawn total at the list level. Per-customer spend lives on each
 * row instead.
 */
export interface CustomerSummary {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  suspendedCustomers: number;
  totalBalance: string;
  totalBonusBalance: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  customerUsername: string | null;
  type: TransactionType;
  amount: string;
  gameName: string | null;
  status: string;
  channel: string | null;
  referenceNo: string | null;
  /**
   * A credit with a parent is a CORRECTION of an earlier entry, not a
   * withdrawal. Reports that conflate the two misstate what a customer
   * actually took out.
   */
  isCorrection: boolean;
  parentTransactionId: string | null;
  note: string | null;
  enteredByUsername: string | null;
  occurredAt: string;
}

export interface TransactionSummary {
  totalCount: number;
  /** Debit — money in. */
  totalIn: string;
  /** Credit with no parent — money actually taken out. */
  totalOut: string;
  net: string;
  correctionCount: number;
  /** Credits WITH a parent. Counted apart from `totalOut` on purpose. */
  correctionTotal: string;
}

/** A money window: in, out, and the net of the two. */
export interface PeriodTotals {
  totalIn: string;
  totalOut: string;
  balance: string;
  transactionCount: number;
}

export interface MonthTotals extends PeriodTotals {
  /** Movement against the previous month. A number, not money. */
  changePercent: number;
  previousBalance: string;
}

export interface DashboardMetrics {
  scope: StaffRole;
  allTime: PeriodTotals;
  thisMonth: MonthTotals;
  topGamesByDebit: GameTotal[];
  topGamesByCredit: GameTotal[];
  customers: {
    total: number;
    active: number;
    inactive: number;
    newThisMonth: number;
  };
  vips: {
    activeVips: number;
    byTier: { tier: number; count: number }[];
  };
  messaging: {
    unreadMessages: number;
    conversationsToday: number;
    responsesToday: number;
    awaitingReply: number;
  };
  teamRollup: TeamRollupRow[];
  generatedAt: string;
}

export interface TeamRollupRow {
  staffId: string;
  username: string;
  role: StaffRole;
  customerCount: number;
  totalIn: string;
  totalOut: string;
  balance: string;
}

export interface GameTotal {
  /**
   * Null when the entries were recorded against no game. That is a real
   * bucket, not missing data, so it is labelled rather than dropped.
   */
  gameId: string | null;
  gameName: string | null;
  total: string;
  transactionCount: number;
}

export type TrendGranularity = 'day' | 'week' | 'month';

export interface TrendPoint {
  /** Bucket start, `YYYY-MM-DD`. */
  bucket: string;
  totalIn: string;
  totalOut: string;
  balance: string;
  transactionCount: number;
}

export interface TrendResponse {
  granularity: TrendGranularity;
  /**
   * Gap-filled by the API: buckets with no activity come back as zeros
   * rather than being omitted, so a chart draws a flat line through a quiet
   * period instead of joining across it.
   */
  points: TrendPoint[];
}
