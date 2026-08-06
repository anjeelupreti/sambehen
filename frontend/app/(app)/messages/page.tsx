import type { Metadata } from 'next';

import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { ExportButton } from '@/components/export-button';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
import { MessagingView } from '@/components/messaging/messaging-view';
import { SearchField } from '@/components/search-field';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { apiList } from '@/lib/api';
import { formatCount } from '@/lib/money';
import type { Conversation, ConversationSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Messages' };

const STATE_OPTIONS = [{ value: 'true', label: 'Unread only' }];

const AWAITING_OPTIONS = [{ value: 'true', label: 'Awaiting reply' }];

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'unreadOnly', label: 'State', labels: { true: 'Unread' } },
  { param: 'awaitingReply', label: 'Awaiting', labels: { true: 'Awaiting reply' } },
  { param: 'todayOnly', label: 'Today', labels: { true: 'Today' } },
  { param: 'dateFrom', label: 'From' },
  { param: 'dateTo', label: 'To' },
];

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const { data, summary } = await apiList<Conversation, ConversationSummary>(
    '/team/conversations',
    {
      query: {
        // The thread pane holds one conversation; the list is scrolled, not
        // paged, so it takes a single generous page rather than pagination
        // controls that would fight the live updates.
        limit: 100,
        search: first('search'),
        unreadOnly: first('unreadOnly'),
        awaitingReply: first('awaitingReply'),
        todayOnly: first('todayOnly'),
        status: first('status'),
        dateFrom: first('dateFrom'),
        dateTo: first('dateTo'),
      },
    },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-muted-foreground text-sm">
            Threads with your customers. A manager sees their runners&apos; conversations, and which
            staff member replied is recorded on every message.
          </p>
        </div>
        <ExportButton exportKey="conversations" />
      </header>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Conversations" value={formatCount(summary.totalConversations)} />
          <StatCard
            label="Unread"
            value={formatCount(summary.totalUnreadMessages)}
            hint={`Across ${formatCount(summary.unreadConversations)} conversations.`}
          />
          <StatCard
            label="Awaiting reply"
            value={formatCount(summary.awaitingReply)}
            hint="Customer spoke last."
          />
          <StatCard
            label="Replies today"
            value={formatCount(summary.responsesToday)}
            hint={`${formatCount(summary.conversationsToday)} conversations active today.`}
          />
        </section>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search customer or message…" />
            <FilterSelect
              param="unreadOnly"
              label="State"
              options={STATE_OPTIONS}
              anyLabel="All conversations"
              className="w-[170px]"
            />
            <FilterSelect
              param="awaitingReply"
              label="Awaiting"
              options={AWAITING_OPTIONS}
              anyLabel="Any"
              className="w-[160px]"
            />
            <DateRangeFilter label="Last message" />
          </FilterBar>
        </CardContent>
      </Card>

      <MessagingView initialConversations={data} />
    </div>
  );
}
