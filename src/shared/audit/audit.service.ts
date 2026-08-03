import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@database/database.provider';
import { auditLogs, NewAuditLog } from '@database/schema/audit-logs.schema';
import { RequestContext } from '@common/context/request-context';
import { IPaginatedResult } from '@common/interfaces/pagination.interface';
import { IAuditLogFilters, IAuditLogRow, IAuditLogSummary } from './audit.types';

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
   * Request context (correlation id, IP, user agent, method, path) is
   * filled in from the ambient RequestContext when the caller has not
   * supplied it, so a service can record a rich before/after entry without
   * accepting an HTTP request object. Outside a request — background jobs,
   * seeders — those fields are simply absent.
   *
   * Never throws: an audit write failing must not roll back or fail the
   * business operation the user actually requested. Failures are logged at
   * error level so they surface in monitoring instead.
   */
  async record(entry: NewAuditLog): Promise<void> {
    const context = RequestContext.get();

    try {
      await this.db.insert(auditLogs).values({
        ...entry,
        correlationId: entry.correlationId ?? context?.correlationId,
        ip: entry.ip ?? context?.ip,
        userAgent: entry.userAgent ?? context?.userAgent,
        method: entry.method ?? context?.method,
        path: entry.path ?? context?.path,
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
   * Reads the trail.
   *
   * Master-only at the controller, and there is deliberately no scoped
   * variant: entries record actions across every chain and their payloads
   * name customers, so handing a manager a filtered view would leak the
   * existence of rows the rest of the system hides from them.
   *
   * `before`/`after` payloads are omitted from the list. They are large,
   * they are the most sensitive part of a row even after redaction, and a
   * list view cannot render them usefully anyway.
   */
  async findAll(
    filters: IAuditLogFilters,
  ): Promise<IPaginatedResult<IAuditLogRow, IAuditLogSummary>> {
    const conditions: SQL[] = [];

    if (filters.actorType) conditions.push(eq(auditLogs.actorType, filters.actorType));
    if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
    if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
    if (filters.correlationId) {
      conditions.push(eq(auditLogs.correlationId, filters.correlationId));
    }

    // Prefix match, so 'customer.' returns every customer action rather
    // than forcing the caller to know the exact verb.
    if (filters.action) {
      conditions.push(sql`${auditLogs.action} LIKE ${`${this.escapeLike(filters.action)}%`}`);
    }

    if (filters.lastNDays) {
      conditions.push(
        sql`${auditLogs.createdAt} >= NOW() - ${`${filters.lastNDays} days`}::interval`,
      );
    } else {
      if (filters.dateFrom) conditions.push(sql`${auditLogs.createdAt} >= ${filters.dateFrom}`);
      if (filters.dateTo) conditions.push(sql`${auditLogs.createdAt} <= ${filters.dateTo}`);
    }

    if (filters.search) {
      const term = `%${this.escapeLike(filters.search)}%`;
      conditions.push(
        sql`(${auditLogs.action} ILIKE ${term} OR ${auditLogs.path} ILIKE ${term} OR ${auditLogs.entityType} ILIKE ${term})`,
      );
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(Math.max(1, filters.limit ?? 25), 100);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalRow], [summaryRow]] = await Promise.all([
      this.db
        .select({
          id: auditLogs.id,
          actorType: auditLogs.actorType,
          actorId: auditLogs.actorId,
          actorRole: auditLogs.actorRole,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          method: auditLogs.method,
          path: auditLogs.path,
          statusCode: auditLogs.statusCode,
          ip: auditLogs.ip,
          correlationId: auditLogs.correlationId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        // Newest first with an id tie-break: entries written inside one
        // transaction share a timestamp, and without the tie-break they
        // could shuffle between pages.
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ value: count() }).from(auditLogs).where(where),
      this.db
        .select({
          totalEntries: count(),
          distinctActors: sql<number>`COUNT(DISTINCT ${auditLogs.actorId})`,
          distinctActions: sql<number>`COUNT(DISTINCT ${auditLogs.action})`,
          failedRequests: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.statusCode} >= 400)`,
        })
        .from(auditLogs)
        .where(where),
    ]);

    const total = Number(totalRow?.value ?? 0);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      summary: {
        totalEntries: Number(summaryRow?.totalEntries ?? 0),
        distinctActors: Number(summaryRow?.distinctActors ?? 0),
        distinctActions: Number(summaryRow?.distinctActions ?? 0),
        failedRequests: Number(summaryRow?.failedRequests ?? 0),
      },
    };
  }

  /** Escapes LIKE wildcards so a user's `%` matches a literal `%`. */
  private escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, (match) => `\\${match}`);
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
