import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
import { PaginationControls } from '@/components/pagination-controls';
import { SearchField } from '@/components/search-field';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiList } from '@/lib/api';
import { formatCount, formatDateTime } from '@/lib/money';
import { getActor } from '@/lib/session';
import type { AuditLog, AuditLogSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Audit trail' };

const ACTOR_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'customer', label: 'Customer' },
  { value: 'system', label: 'System' },
];

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'actorType', label: 'Actor' },
  { param: 'action', label: 'Action' },
  { param: 'entityType', label: 'Entity' },
  { param: 'correlationId', label: 'Correlation' },
  { param: 'dateFrom', label: 'From' },
  { param: 'dateTo', label: 'To' },
];

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();

  // Master-only and deliberately unscoped: the trail exists to be read by
  // someone outside the chain being audited.
  if (actor?.role !== 'master') notFound();

  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const { data, meta, summary } = await apiList<AuditLog, AuditLogSummary>('/team/audit-logs', {
    query: {
      page: first('page') ?? 1,
      limit: 25,
      search: first('search'),
      actorType: first('actorType'),
      action: first('action'),
      entityType: first('entityType'),
      entityId: first('entityId'),
      correlationId: first('correlationId'),
      dateFrom: first('dateFrom'),
      dateTo: first('dateTo'),
      sortBy: first('sortBy'),
      sortOrder: first('sortOrder'),
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1>
        <p className="text-muted-foreground text-sm">
          Append-only record of every state-changing action. Master only, and unscoped by design.
        </p>
      </header>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Entries" value={formatCount(summary.totalEntries)} />
          <StatCard label="Distinct actors" value={formatCount(summary.distinctActors)} />
          <StatCard label="Distinct actions" value={formatCount(summary.distinctActions)} />
          <StatCard
            label="Failed requests"
            value={formatCount(summary.failedRequests)}
            hint="Recorded even when the action was refused."
          />
        </section>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search action, entity, path…" />
            <FilterSelect param="actorType" label="Actor" options={ACTOR_OPTIONS} />
            <DateRangeFilter label="When" />
          </FilterBar>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Request</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                    No entries match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {entry.actorType}
                      </Badge>
                      {entry.actorRole ? (
                        <p className="text-muted-foreground mt-0.5 text-xs capitalize">
                          {entry.actorRole}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">{entry.action}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {entry.entityType ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate text-sm">
                      <span className="tabular">{entry.method}</span> {entry.path}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Failures are the interesting rows in an audit
                          trail, so they are marked rather than left to be
                          spotted by reading the number. Null means the entry
                          was written outside a request — a scheduled job —
                          which is not a failure. */}
                      {entry.statusCode === null ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : (
                        <Badge
                          variant={entry.statusCode >= 400 ? 'destructive' : 'outline'}
                          className="tabular"
                        >
                          {entry.statusCode}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <PaginationControls meta={meta} />
        </CardContent>
      </Card>
    </div>
  );
}
