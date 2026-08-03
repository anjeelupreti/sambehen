/**
 * Query shapes for reading the audit trail.
 *
 * Kept as plain interfaces here rather than DTOs so `AuditService` — which
 * lives in `shared/` and is injected almost everywhere — does not depend on
 * a feature module's HTTP layer. The controller owns the decorated DTOs and
 * passes plain objects down.
 */
export interface IAuditLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  actorType?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  lastNDays?: number;
}

export interface IAuditLogRow {
  id: string;
  actorType: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ip: string | null;
  correlationId: string | null;
  createdAt: Date;
}

export interface IAuditLogSummary {
  totalEntries: number;
  distinctActors: number;
  distinctActions: number;
  failedRequests: number;
}
