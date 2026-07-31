/** Header names propagated through logs, audit rows and error payloads. */
export const CORRELATION_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * The two independent authentication realms.
 *
 * Team and customer tokens are signed with different secrets and validated
 * by different passport strategies, so a customer token can never be
 * replayed against a team route (and vice versa).
 */
export enum AuthRealm {
  TEAM = 'team',
  CUSTOMER = 'customer',
}

/** Business-side roles. Hierarchy: master -> manager -> runner. */
export enum StaffRole {
  MASTER = 'master',
  MANAGER = 'manager',
  RUNNER = 'runner',
}

/**
 * Seniority rank, used to answer "can actor A manage staff B".
 * Higher rank manages lower rank; equal ranks never manage each other.
 */
export const STAFF_ROLE_RANK: Readonly<Record<StaffRole, number>> = Object.freeze({
  [StaffRole.MASTER]: 3,
  [StaffRole.MANAGER]: 2,
  [StaffRole.RUNNER]: 1,
});

export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

/**
 * Transaction direction.
 *
 * DEBIT  - money IN from the customer (deposit / spend).
 * CREDIT - money OUT to the customer.
 *
 * A CREDIT carrying `parentTransactionId` is a correction against an
 * existing transaction, NOT a withdrawal. See docs/IMPLEMENTATION_PLAN.md §5.
 */
export enum TransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REVERSED = 'reversed',
}

/** Which quantity a VIP criteria measures against its threshold. */
export enum VipMetric {
  TOTAL_DEBIT = 'total_debit',
  NET = 'net',
  TRANSACTION_COUNT = 'transaction_count',
}

export enum SpinSelectionMode {
  /** Winners chosen from qualified VIPs at event-creation time. */
  PRESELECTED = 'preselected',
  /** Winners recorded after the draw as a data-entry step. */
  POST_DRAW = 'post_draw',
}

export enum SpinEventStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ReferralRewardType {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
}

export enum ReferralStatus {
  PENDING = 'pending',
  QUALIFIED = 'qualified',
  REWARDED = 'rewarded',
  REJECTED = 'rejected',
}

export enum BonusDirection {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

export enum MessageSenderType {
  CUSTOMER = 'customer',
  STAFF = 'staff',
  SYSTEM = 'system',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  PARTIAL = 'partial',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum RecipientStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  BOUNCED = 'bounced',
}

export enum ExportFormat {
  XLSX = 'xlsx',
  CSV = 'csv',
}

export enum ExportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/** Comparison operators exposed by numeric range filters (e.g. email targeting). */
export enum ComparisonOperator {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  EQ = 'eq',
  BETWEEN = 'between',
}
