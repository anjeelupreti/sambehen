import type { Metadata } from 'next';
import Link from 'next/link';

import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
import { ExportButton } from '@/components/export-button';
import { SortableHeader } from '@/components/filters/sortable-header';
import { Money } from '@/components/money';
import { PaginationControls } from '@/components/pagination-controls';
import { SearchField } from '@/components/search-field';
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
import { formatDate } from '@/lib/money';
import type { Vip, VipCriteria } from '@/lib/types';
import { getActor } from '@/lib/session';
import { VipCriteriaModal } from '@/components/forms/vip-criteria-modal';
import { VipCriteriaActions } from '@/components/vip-criteria-actions';

export const metadata: Metadata = { title: 'VIPs' };

const STATE_OPTIONS = [{ value: 'true', label: 'Currently qualifying' }];

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'tier', label: 'Tier' },
  { param: 'activeOnly', label: 'State', labels: { true: 'Currently qualifying' } },
  { param: 'dateFrom', label: 'From' },
  { param: 'dateTo', label: 'To' },
];

export default async function VipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const actor = await getActor();

  // Only a master may define criteria, so only they need the list. Fetched
  // alongside the qualifications rather than on a separate page.
  const criteriaPromise =
    actor?.role === 'master'
      ? apiList<VipCriteria>('/team/vip-criteria', { query: { limit: 50 } })
      : null;

  const { data, meta } = await apiList<Vip>('/team/vips', {
    query: {
      page: first('page') ?? 1,
      limit: 20,
      search: first('search'),
      tier: first('tier'),
      activeOnly: first('activeOnly'),
      criteriaId: first('criteriaId'),
      dateFrom: first('dateFrom'),
      dateTo: first('dateTo'),
      sortBy: first('sortBy'),
      sortOrder: first('sortOrder'),
    },
  });

  const criteria = criteriaPromise ? (await criteriaPromise).data : [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">VIPs</h1>
          <p className="text-muted-foreground text-sm">
            Qualification is computed from recorded activity against a master-defined criteria — it
            is never typed in by hand.
          </p>
        </div>
        <ExportButton exportKey="vips" />
      </header>

      {/* Criteria sit above the qualifications they produce: a threshold is
          only meaningful next to who currently meets it. Master only —
          criteria are theirs to define. */}
      {actor?.role === 'master' ? <VipCriteriaSection criteria={criteria} /> : null}

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search customer…" />
            <FilterSelect
              param="activeOnly"
              label="State"
              options={STATE_OPTIONS}
              anyLabel="All qualifications"
              className="w-[190px]"
            />
            <DateRangeFilter label="Qualified" />
          </FilterBar>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <SortableHeader column="tier">Tier</SortableHeader>
                <TableHead>Criteria</TableHead>
                <SortableHeader column="achievedAmount" align="right">
                  Achieved
                </SortableHeader>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead>Period</TableHead>
                <SortableHeader column="qualifiedAt">Qualified</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                    No qualifications match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((vip) => (
                  <TableRow key={vip.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${vip.customerId}`}
                        className="font-medium hover:underline"
                      >
                        {vip.customerUsername}
                      </Link>
                      {vip.customerFullName ? (
                        <p className="text-muted-foreground text-xs">{vip.customerFullName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary">Tier {vip.tier}</Badge>
                        {/* Qualification is scoped to a period, so a past
                            qualification stays on the record rather than
                            disappearing when it lapses. */}
                        {vip.isCurrentlyActive ? null : (
                          <Badge variant="outline" title="Qualified in an earlier period">
                            lapsed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {vip.criteriaName}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={vip.achievedAmount} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm">
                      <Money value={vip.thresholdAmount} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(vip.periodStart)} – {formatDate(vip.periodEnd)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(vip.qualifiedAt)}
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

/**
 * The criteria that produce the qualifications listed below.
 *
 * Kept on the same page deliberately: a threshold read apart from the
 * people currently meeting it tells you very little.
 */
function VipCriteriaSection({ criteria }: { criteria: VipCriteria[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div>
            <h2 className="text-sm font-semibold">VIP criteria</h2>
            <p className="text-muted-foreground text-xs">
              Metric, threshold and period. Recompute re-runs qualification against recorded
              activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton exportKey="vip-criteria" />
            <VipCriteriaModal />
          </div>
        </div>

        {criteria.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No criteria yet. Nothing can qualify until one exists.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criteria</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Tier {item.tier}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {item.metric.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={item.thresholdAmount} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(item.periodStart)} – {formatDate(item.periodEnd)}
                  </TableCell>
                  <TableCell>
                    {item.isCurrentlyActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <VipCriteriaModal criteria={item} />
                      <VipCriteriaActions criteria={item} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
