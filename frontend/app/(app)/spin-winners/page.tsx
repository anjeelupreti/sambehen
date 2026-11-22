import type { Metadata } from 'next';
import Link from 'next/link';

import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { ExportButton } from '@/components/export-button';
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
import type { SpinEvent, SpinWinner, SpinWinnerSummary } from '@/lib/types';
import { getActor } from '@/lib/session';
import { RecordWinnersModal } from '@/components/spin/record-winners-modal';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/money';

export const metadata: Metadata = { title: 'Rewards' };

/** Event state, on the shared status colours: done is success, running needs watching. */
const EVENT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'secondary'> = {
  completed: 'success',
  live: 'warning',
  scheduled: 'outline',
  cancelled: 'secondary',
};

/**
 * A winner can be chosen before the draw or recorded after it. The
 * distinction is auditable and is shown rather than smoothed over.
 */
const SELECTION_OPTIONS = [
  { value: 'true', label: 'Preselected' },
  { value: 'false', label: 'Chosen after' },
];

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  {
    param: 'isPreselected',
    label: 'Selection',
    labels: { true: 'Preselected', false: 'Chosen after' },
  },
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

  const actor = await getActor();

  // Events sit above the winners they produce, the same way criteria sit
  // above VIP qualifications: a draw is only meaningful next to who won it.
  const eventsPromise = apiList<SpinEvent>('/team/spin-events', { query: { limit: 25 } });

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

  const { data: events } = await eventsPromise;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Rewards</h1>
        </div>
        <ExportButton exportKey="spin-winners" />
      </header>

      <SpinEventsSection events={events} canManage={actor?.role === 'master'} />

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Recipients" value={formatCount(summary.totalWinners)} />
          <StatCard label="Distinct customers" value={formatCount(summary.distinctCustomers)} />
          <StatCard label="Total rewarded" value={<Money value={summary.totalPrizeAmount} />} />
          <StatCard
            label="Preselected"
            value={formatCount(summary.preselectedCount)}
            hint="Chosen before the event"
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
                <TableHead>Reward</TableHead>
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
                    No recipients match these filters.
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
                        {winner.customerFullName || winner.customerUsername}
                      </Link>
                      {(winner.storeUsername ?? winner.managerUsername) ? (
                        <p className="text-muted-foreground text-xs">
                          {winner.storeUsername ?? winner.managerUsername}
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
                          <Badge variant="outline" title="Chosen before the event">
                            Preselected
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

/**
 * The events that produced the winners listed below.
 *
 * On the same page on purpose: a draw read apart from who won it says very
 * little, and the winners list is the reason anyone opens an event.
 */
function SpinEventsSection({ events, canManage }: { events: SpinEvent[]; canManage: boolean }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <h2 className="text-sm font-semibold">Reward events</h2>
          <div className="flex items-center gap-2">
            <ExportButton exportKey="spin-events" />
            {canManage ? (
              <Button asChild size="sm">
                <Link href="/spin-events/new">New event</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {events.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">No reward events yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Selection</TableHead>
                <TableHead className="text-right">Reward pool</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="w-40">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {event.vipCriteriaName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={EVENT_STATUS_VARIANT[event.status] ?? 'outline'}
                      className="capitalize"
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {/* Preselected means winners were chosen before the draw
                        rather than after it. It is auditable, so it is shown. */}
                    {event.selectionMode === 'preselected' ? 'Preselected' : 'Chosen after'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={event.prizePool} />
                  </TableCell>
                  <TableCell className="tabular text-right">{event.winnerCount}</TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {event.scheduledAt ? formatDate(event.scheduledAt) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Only a post-draw event can take winners afterwards; a
                        preselected one already carries them and the API
                        refuses more, so the option is absent rather than
                        present-and-failing. */}
                    {canManage && event.selectionMode === 'post_draw' ? (
                      <RecordWinnersModal
                        eventId={event.id}
                        eventName={event.name}
                        criteriaId={event.vipCriteriaId}
                      />
                    ) : null}
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
