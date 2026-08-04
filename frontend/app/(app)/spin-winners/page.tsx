import type { Metadata } from 'next';
import Link from 'next/link';

import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
import { SortableHeader } from '@/components/filters/sortable-header';
import { Money } from '@/components/money';
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
import type { SpinWinner, SpinWinnerSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Spin winners' };

/**
 * A winner can be chosen before the draw or recorded after it. The
 * distinction is auditable and is shown rather than smoothed over.
 */
const SELECTION_OPTIONS = [
  { value: 'true', label: 'Preselected' },
  { value: 'false', label: 'Drawn' },
];

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'isPreselected', label: 'Selection', labels: { true: 'Preselected', false: 'Drawn' } },
  { param: 'dateFrom', label: 'From' },
  { param: 'dateTo', label: 'To' },
];

export default async function SpinWinnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const { data, meta, summary } = await apiList<SpinWinner, SpinWinnerSummary>(
    '/team/spin-winners',
    {
      query: {
        page: first('page') ?? 1,
        limit: 20,
        search: first('search'),
        isPreselected: first('isPreselected'),
        spinEventId: first('spinEventId'),
        customerId: first('customerId'),
        dateFrom: first('dateFrom'),
        dateTo: first('dateTo'),
        sortBy: first('sortBy'),
        sortOrder: first('sortOrder'),
      },
    },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Spin winners</h1>
        <p className="text-muted-foreground text-sm">
          Winners of spin events run against an active VIP criteria.
        </p>
      </header>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Winners" value={formatCount(summary.totalWinners)} />
          <StatCard
            label="Distinct customers"
            value={formatCount(summary.distinctCustomers)}
            hint="One customer can win more than once."
          />
          <StatCard label="Total prizes" value={<Money value={summary.totalPrizeAmount} />} />
          <StatCard
            label="Preselected"
            value={formatCount(summary.preselectedCount)}
            hint="Chosen before the draw rather than after it."
          />
        </section>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search customer or event…" />
            <FilterSelect
              param="isPreselected"
              label="Selection"
              options={SELECTION_OPTIONS}
              anyLabel="Any selection"
              className="w-[170px]"
            />
            <DateRangeFilter label="Announced" />
          </FilterBar>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Event</TableHead>
                <SortableHeader column="rank" align="right">
                  Rank
                </SortableHeader>
                <TableHead>Prize</TableHead>
                <SortableHeader column="prizeAmount" align="right">
                  Amount
                </SortableHeader>
                <SortableHeader column="announcedAt">Announced</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                    No winners match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((winner) => (
                  <TableRow key={winner.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${winner.customerId}`}
                        className="font-medium hover:underline"
                      >
                        {winner.customerUsername}
                      </Link>
                      {(winner.runnerUsername ?? winner.managerUsername) ? (
                        <p className="text-muted-foreground text-xs">
                          {winner.runnerUsername ?? winner.managerUsername}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {winner.eventName}
                    </TableCell>
                    <TableCell className="tabular text-right">{winner.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{winner.prizeLabel}</span>
                        {winner.isPreselected ? (
                          <Badge variant="outline" title="Chosen before the draw">
                            preselected
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={winner.prizeAmount} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDateTime(winner.announcedAt)}
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
