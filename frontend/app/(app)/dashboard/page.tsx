import type { Metadata } from 'next';

import { ChartCard } from '@/components/charts/chart-card';
import { GameDotPlot } from '@/components/charts/game-dot-plot';
import { TrendChart } from '@/components/charts/trend-chart';
import { TrendControls } from '@/components/charts/trend-controls';
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
import { apiGet } from '@/lib/api';
import { formatCount, formatDate } from '@/lib/money';
import { getActor } from '@/lib/session';
import type { DashboardMetrics, GameTotal, TrendGranularity, TrendResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

const GRANULARITIES: TrendGranularity[] = ['day', 'week', 'month'];

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

  const [actor, metrics, trends] = await Promise.all([
    getActor(),
    apiGet<DashboardMetrics>('/team/dashboard'),
    apiGet<TrendResponse>('/team/dashboard/trends', {
      query: { granularity, lastNDays: range },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {actor?.role === 'master'
            ? 'Across every chain.'
            : 'Limited to the customers you can see.'}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Customers"
          value={formatCount(metrics.customers.total)}
          hint={`${formatCount(metrics.customers.newThisMonth)} new this month.`}
        />
        <StatCard
          label="Active"
          value={formatCount(metrics.customers.active)}
          hint="Active within the configured activity window."
        />
        <StatCard label="Net (all time)" value={<Money value={metrics.allTime.balance} />} />
        <StatCard
          label="Net (this month)"
          value={<Money value={metrics.thisMonth.balance} />}
          hint={describeChange(metrics.thisMonth.changePercent)}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Debit (all time)"
          value={<Money value={metrics.allTime.totalIn} />}
          hint="Money in."
        />
        <StatCard
          label="Credit (all time)"
          value={<Money value={metrics.allTime.totalOut} />}
          hint="Money out, excluding corrections."
        />
        <StatCard label="Debit (month)" value={<Money value={metrics.thisMonth.totalIn} />} />
        <StatCard label="Credit (month)" value={<Money value={metrics.thisMonth.totalOut} />} />
      </section>

      <ChartCard
        title="Money in and out over time"
        description="Empty periods are real zeros, not missing data."
        controls={<TrendControls />}
        chart={<TrendChart points={trends.points} granularity={granularity} />}
        table={<TrendTable points={trends.points} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Top games by debit"
          chart={<GameDotPlot rows={metrics.topGamesByDebit} measure="debit" />}
          table={<GameTable rows={metrics.topGamesByDebit} />}
        />
        <ChartCard
          title="Top games by credit"
          chart={<GameDotPlot rows={metrics.topGamesByCredit} measure="credit" />}
          table={<GameTable rows={metrics.topGamesByCredit} />}
        />
      </div>
    </div>
  );
}

/**
 * Month-on-month movement.
 *
 * `changePercent` is a percentage, not money, so it is a real number and is
 * formatted as one. A previous month of zero makes the change meaningless
 * rather than infinite, which the API reports as -100.
 */
function describeChange(changePercent: number): string {
  if (!Number.isFinite(changePercent) || changePercent === 0) return 'Level with last month.';
  const direction = changePercent > 0 ? 'up' : 'down';
  return `${Math.abs(Math.round(changePercent))}% ${direction} on last month.`;
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
            <TableHead className="text-right">In</TableHead>
            <TableHead className="text-right">Out</TableHead>
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

function GameTable({ rows }: { rows: GameTotal[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Nothing recorded yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Game</TableHead>
          <TableHead className="text-right">Entries</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          // Entries recorded against no game come back with a null id and
          // name. That is a real bucket, so it is labelled rather than
          // dropped, and the row still needs a stable key.
          <TableRow key={row.gameId ?? 'unassigned'}>
            <TableCell className="font-medium">{row.gameName ?? 'No game'}</TableCell>
            <TableCell className="tabular text-right">
              {formatCount(row.transactionCount)}
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.total} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
