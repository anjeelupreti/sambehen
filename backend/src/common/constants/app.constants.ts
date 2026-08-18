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

/** Business-side roles. Hierarchy: master -> manager -> store. */
export enum StaffRole {
  MASTER = 'master',
  MANAGER = 'manager',
  STORE = 'store',
}

/**
 * Seniority rank, used to answer "can actor A manage staff B".
 * Higher rank manages lower rank; equal ranks never manage each other.
 */
export const STAFF_ROLE_RANK: Readonly<Record<StaffRole, number>> = Object.freeze({
  [StaffRole.MASTER]: 3,
  [StaffRole.MANAGER]: 2,
  [StaffRole.STORE]: 1,
});

export enum CustomerStatus {
  /** Self-registered, not yet reviewed. Cannot sign in until a master approves it. */
  PENDING = 'pending',
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

/**
 * What kind of email a message is.
 *
 * Decides the layout accent, the header badge and — importantly — whether
 * an unsubscribe footer appears. Marketing mail must offer an opt-out and
 * transactional mail must not, so this is a content rule rather than a
 * styling choice.
 *
 * Lives here rather than beside the template service because the email
 * schema references it, and a schema file must stay free of decorated
 * NestJS classes: drizzle-kit compiles schemas with esbuild, which cannot
 * transform decorators.
 */
export enum EmailKind {
  /** Marketing: campaigns, offers, announcements. Unsubscribable. */
  PROMOTIONAL = 'promotional',
  /** Neutral updates: statements, summaries, general notices. Unsubscribable. */
  INFORMATIONAL = 'informational',
  /** Something happened on the account: a win, a bonus, a VIP tier. */
  NOTIFICATION = 'notification',
  /** Account and security mail. Never unsubscribable. */
  TRANSACTIONAL = 'transactional',
  /** Needs attention: a failure, a suspension, a problem. */
  ALERT = 'alert',
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
