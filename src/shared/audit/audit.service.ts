import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { auditLogs, NewAuditLog } from '@database/schema/audit-logs.schema';

/** Field names scrubbed from any payload before it is persisted. */
const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
]);

const REDACTED = '[REDACTED]';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER)
    private readonly db: DrizzleDB,
  ) {}

  /**
   * Appends an audit entry.
   *
   * Never throws: an audit write failing must not roll back or fail the
   * business operation the user actually requested. Failures are logged at
   * error level so they surface in monitoring instead.
   */
  async record(entry: NewAuditLog): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        ...entry,
        before: entry.before ? this.redact(entry.before) : entry.before,
        after: entry.after ? this.redact(entry.after) : entry.after,
        metadata: entry.metadata ? this.redact(entry.metadata) : entry.metadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry for action "${entry.action}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Recursively replaces secret-bearing values.
   *
   * Audit rows are long-lived and widely readable, so a password arriving
   * in a request body must never be persisted verbatim.
   */
  redact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        result[key] = REDACTED_KEYS.has(key.toLowerCase()) ? REDACTED : this.redact(nested);
      }
      return result;
    }

    return value;
  }
}
