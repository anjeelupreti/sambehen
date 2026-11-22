import type { Metadata } from 'next';

import { ChartCard } from '@/components/charts/chart-card';
import { RankedBars } from '@/components/charts/ranked-bars';
import { TrendChart } from '@/components/charts/trend-chart';
import { TrendControls } from '@/components/charts/trend-controls';
import { AttentionPanel, type AttentionItem } from '@/components/dashboard/attention-panel';
import { MoneySummary } from '@/components/dashboard/money-summary';
import { TeamBreakdown } from '@/components/dashboard/team-breakdown';
import { RecordTransactionModal } from '@/components/forms/record-transaction-modal';
import { Money } from '@/components/money';
import { StatCard } from '@/components/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiList } from '@/lib/api';
import { formatCount, formatDate } from '@/lib/money';
import { getActor } from '@/lib/session';
import type {
  DashboardMetrics,
  Game,
  GameTotal,
  TrendGranularity,
  TrendResponse,
} from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

const GRANULARITIES: TrendGranularity[] = ['day', 'week', 'month'];

/**
 * One dashboard, shaped by role. Everything is scoped by the API to the
 * signed-in person's part of the chain; what changes per role is what is
 * worth showing: a master sees managers compared and the approval queue, a
 * manager sees their stores compared, a store sees its own figures and the
 * work waiting on it.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // Validated here rather than forwarded blind: these two drive the chart's
  // own rendering as well as the request, so an unrecognised value would
  // mislabel the axis even though the API had already rejected it.
  const requested = first('granularity');
  const granularity: TrendGranularity = GRANULARITIES.includes(requested as TrendGranularity)
    ? (requested as TrendGranularity)
    : 'day';

  const lastNDays = Number(first('lastNDays'));
  const range = Number.isInteger(lastNDays) && lastNDays > 0 && lastNDays <= 730 ? lastNDays : 30;

  const [actor, metrics, trends, games] = await Promise.all([
    getActor(),
    apiGet<DashboardMetrics>('/team/dashboard'),
    apiGet<TrendResponse>('/team/dashboard/trends', {
      query: { granularity, lastNDays: range },
    }),
    apiList<Game>('/team/games', { query: { limit: 100, isActive: true } }),
  ]);

  const role = actor?.role;
  const attention: AttentionItem[] = [
    ...(role === 'master'
      ? [
          {
            key: 'approvals',
            label: 'Customers waiting for approval',
            count: metrics.customers.pendingApproval,
            href: '/customers?status=pending',
            icon: 'approval' as const,
          },
        ]
      : []),
    {
      key: 'replies',
      label: 'Conversations waiting for a reply',
      count: metrics.messaging.awaitingReply,
      href: '/messages',
      icon: 'reply',
    },
    {
      key: 'unread',
      label: 'Unread messages',
      count: metrics.messaging.unreadMessages,
      href: '/messages',
      icon: 'unread',
    },
  ];

  const vipTiers = metrics.vips.byTier
    .map((tier) => `${formatCount(tier.count)} in tier ${tier.tier}`)
    .join(', ');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <RecordTransactionModal games={games.data} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <MoneySummary
          net={metrics.thisMonth.balance}
          moneyIn={metrics.thisMonth.totalIn}
          moneyOut={metrics.thisMonth.totalOut}
          changePercent={metrics.thisMonth.changePercent}
          allTimeNet={metrics.allTime.balance}
        />
        <AttentionPanel items={attention} />
      </div>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Customers"
          value={formatCount(metrics.customers.total)}
          hint={`${formatCount(metrics.customers.newThisMonth)} new this month`}
        />
        <StatCard
          label="Active"
          value={formatCount(metrics.customers.active)}
          hint={`${formatCount(metrics.customers.inactive)} inactive`}
        />
        <StatCard
          label="VIP players"
          value={formatCount(metrics.vips.activeVips)}
          hint={vipTiers || undefined}
        />
        <StatCard
          label="Replies today"
          value={formatCount(metrics.messaging.responsesToday)}
          hint={`${formatCount(metrics.messaging.conversationsToday)} conversations today`}
        />
      </section>

      <section aria-labelledby="trend-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="trend-title" className="text-lg font-semibold">
            Money in and out
          </h2>
          <TrendControls />
        </div>
        <ChartCard
          title={`Last ${range} days, by ${granularity}`}
          chart={<TrendChart points={trends.points} granularity={granularity} />}
          table={<TrendTable points={trends.points} />}
        />
      </section>

      {actor && (
        <TeamBreakdown
          title={role === 'master' ? 'Managers' : 'Stores'}
          rows={metrics.teamRollup}
          viewerId={actor.id}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="games-in-title" className="bg-card rounded-xl border p-5">
          <h2 id="games-in-title" className="mb-4 text-base font-semibold">
            Top games by money in
          </h2>
          <RankedBars
            rows={toRanked(metrics.topGamesByDebit)}
            barClassName="bg-debit"
            emptyText="Nothing recorded yet."
          />
        </section>
        <section aria-labelledby="games-out-title" className="bg-card rounded-xl border p-5">
          <h2 id="games-out-title" className="mb-4 text-base font-semibold">
            Top games by money out
          </h2>
          <RankedBars
            rows={toRanked(metrics.topGamesByCredit)}
            barClassName="bg-credit"
            emptyText="Nothing recorded yet."
          />
        </section>
      </div>
    </div>
  );
}

function toRanked(rows: GameTotal[]) {
  // Entries recorded against no game come back with a null id and name.
  // That is a real bucket, so it is labelled rather than dropped.
  return rows.map((row) => ({
    key: row.gameId ?? 'unassigned',
    label: row.gameName ?? 'No game',
    value: row.total,
    count: row.transactionCount,
  }));
}

function TrendTable({ points }: { points: TrendResponse['points'] }) {
  if (points.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">Nothing in this period.</p>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Money in</TableHead>
            <TableHead className="text-right">Money out</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="text-right">Entries</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {points.map((point) => (
            <TableRow key={point.bucket}>
              <TableCell className="whitespace-nowrap">{formatDate(point.bucket)}</TableCell>
              <TableCell className="text-right">
                <Money value={point.totalIn} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={point.totalOut} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={point.balance} />
              </TableCell>
              <TableCell className="tabular text-right">
                {formatCount(point.transactionCount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
