import type { Metadata } from 'next';

import { Money } from '@/components/money';
import { StatCard } from '@/components/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/api';
import { formatCount } from '@/lib/money';
import { getActor } from '@/lib/session';
import type { DashboardMetrics } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const [actor, metrics] = await Promise.all([
    getActor(),
    apiGet<DashboardMetrics>('/team/dashboard'),
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
        <StatCard label="Customers" value={formatCount(metrics.totalCustomers)} />
        <StatCard
          label="Active"
          value={formatCount(metrics.activeCustomers)}
          hint="Active within the configured activity window."
        />
        <StatCard label="Net (all time)" value={<Money value={metrics.allTimeNet} />} />
        <StatCard label="Net (this month)" value={<Money value={metrics.monthNet} />} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Debit (all time)"
          value={<Money value={metrics.allTimeDebit} />}
          hint="Money in."
        />
        <StatCard
          label="Credit (all time)"
          value={<Money value={metrics.allTimeCredit} />}
          hint="Money out, excluding corrections."
        />
        <StatCard label="Debit (month)" value={<Money value={metrics.monthDebit} />} />
        <StatCard label="Credit (month)" value={<Money value={metrics.monthCredit} />} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopGames title="Top games by debit" rows={metrics.topGamesByDebit} />
        <TopGames title="Top games by credit" rows={metrics.topGamesByCredit} />
      </div>
    </div>
  );
}

function TopGames({ title, rows }: { title: string; rows: DashboardMetrics['topGamesByDebit'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nothing recorded yet.</p>
        ) : (
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
                <TableRow key={row.gameId}>
                  <TableCell className="font-medium">{row.gameName}</TableCell>
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
        )}
      </CardContent>
    </Card>
  );
}
