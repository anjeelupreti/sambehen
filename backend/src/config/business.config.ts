import { registerAs } from '@nestjs/config';

/**
 * Business rules that are deployment-tunable rather than hard-coded.
 *
 * Each of these appears in the implementation plan as a configurable
 * default. Values that operators change at runtime (rather than at deploy
 * time) move into the `system_settings` table in phase 2; this config
 * supplies their initial values.
 */
export default registerAs('business', () => ({
  /**
   * A customer counts as "active" when their lastActivityAt falls inside
   * this window. Drives the active/inactive filters on customer lists and
   * the email targeting quick filters.
   */
  activeCustomerWindowDays: parseInt(process.env.ACTIVE_CUSTOMER_WINDOW_DAYS || '30', 10),

  /** Boundary between the high-spender and low-spender email filters. */
  highSpenderThreshold: process.env.HIGH_SPENDER_THRESHOLD || '250.00',

  /** Public base URL that referral links are built on. */
  referralLinkBaseUrl: process.env.REFERRAL_LINK_BASE_URL || 'http://localhost:3000/r',

  /** Recipients drained from email_campaign_recipients per dispatcher tick. */
  emailBatchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '50', 10),

  /**
   * Exports up to this many rows stream synchronously; larger ones return
   * 202 with a job id and are built by the background cron.
   */
  exportSyncRowLimit: parseInt(process.env.EXPORT_SYNC_ROW_LIMIT || '50000', 10),

  /** How long a generated export file is retained before the purge job removes it. */
  exportRetentionHours: parseInt(process.env.EXPORT_RETENTION_HOURS || '48', 10),

  exportStoragePath: process.env.EXPORT_STORAGE_PATH || './storage/exports',

  /**
   * Timezone used when writing date cells into spreadsheets. Excel has no
   * timezone concept, so exports commit to one and label it.
   */
  exportTimezone: process.env.EXPORT_TIMEZONE || 'UTC',
}));
