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
  expiresIn: number;
}

export interface TeamLoginResponse extends AuthTokens {
  staff: Staff;
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

export interface CustomerSummary {
  totalCustomers: number;
  activeCustomers: number;
  totalSpent: string;
  totalWithdrawn: string;
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
  totalTransactions: number;
  totalDebit: string;
  totalCredit: string;
  totalCorrections: string;
  net: string;
}

export interface DashboardMetrics {
  totalCustomers: number;
  activeCustomers: number;
  allTimeDebit: string;
  allTimeCredit: string;
  allTimeNet: string;
  monthDebit: string;
  monthCredit: string;
  monthNet: string;
  topGamesByDebit: GameTotal[];
  topGamesByCredit: GameTotal[];
}

export interface GameTotal {
  gameId: string;
  gameName: string;
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
