import type { Metadata } from 'next';
import Link from 'next/link';

import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
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
import type { Vip } from '@/lib/types';

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">VIPs</h1>
        <p className="text-muted-foreground text-sm">
          Qualification is computed from recorded activity against a master-defined criteria — it is
          never typed in by hand.
        </p>
      </header>

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
