import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';

import { ChartCard } from '@/components/charts/chart-card';
import { TrendChart } from '@/components/charts/trend-chart';
import { TrendControls } from '@/components/charts/trend-controls';
import { CustomerActions } from '@/components/customer-actions';
import { RecordTransactionModal } from '@/components/forms/record-transaction-modal';
import { Money } from '@/components/money';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, apiGet, apiList } from '@/lib/api';
import { formatCount, formatDate, formatDateTime } from '@/lib/money';
import type {
  Customer,
  CustomerStatus,
  Game,
  Transaction,
  TrendResponse,
  TrendGranularity,
} from '@/lib/types';

export const metadata: Metadata = { title: 'Customer' };

const GRANULARITIES: TrendGranularity[] = ['day', 'week', 'month'];

const STATUS_VARIANT: Record<CustomerStatus, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    active: 'default',
    inactive: 'secondary',
    suspended: 'outline',
    banned: 'destructive',
  };

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const searchParamsObj = await searchParams;
  const first = (key: string) => {
    const value = searchParamsObj[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const requested = first('granularity');
  const granularity: TrendGranularity = GRANULARITIES.includes(requested as TrendGranularity)
    ? (requested as TrendGranularity)
    : 'day';

  const lastNDays = Number(first('lastNDays'));
  const range = Number.isInteger(lastNDays) && lastNDays > 0 && lastNDays <= 730 ? lastNDays : 30;

  let customer: Customer;
  try {
    customer = await apiGet<Customer>(`/team/customers/${id}`);
  } catch (error) {
    // A 404 here may mean the customer does not exist, or that they belong
    // to another manager's chain. The API makes those indistinguishable on
    // purpose, so this renders the same "not found" for both. Saying
    // "no access" would confirm the record exists.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [recent, { data: games }, trends] = await Promise.all([
    apiList<Transaction>('/team/transactions', {
      query: { customerId: id, limit: 10, sortBy: 'occurredAt', sortOrder: 'desc' },
    }),
    apiList<Game>('/team/games', { query: { limit: 100, isActive: true } }),
    apiGet<TrendResponse>(`/team/customers/${id}/trends`, {
      query: { granularity, lastNDays: range },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/customers">
            <ArrowLeftIcon className="size-4" />
            All customers
          </Link>
        </Button>

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {customer.username}
              </h1>
              <Badge variant={STATUS_VARIANT[customer.status]} className="capitalize">
                {customer.status}
              </Badge>
            </div>
            {customer.fullName ? (
              <p className="text-muted-foreground text-sm">{customer.fullName}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {/* Pre-targeted: opened from a customer's own page, there is
                nothing to search for. */}
            <RecordTransactionModal
              games={games}
              customer={{
                id: customer.id,
                username: customer.username,
                fullName: customer.fullName,
              }}
            />
            <CustomerActions customer={customer} hideView={true} />
          </div>
        </header>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Balance" value={<Money value={customer.balance} />} />
        <StatCard
          label="Total spent"
          value={<Money value={customer.totalSpent} />}
          hint="Money in."
        />
        <StatCard
          label="Total withdrawn"
          value={<Money value={customer.totalWithdrawn} />}
          hint="Excludes corrections."
        />
        <StatCard
          label="Bonus balance"
          value={<Money value={customer.bonusBalance} />}
          hint="Referral bonuses, kept separate from real money."
        />
      </section>

      <ChartCard
        title="Transaction History"
        description="Customer's money in and out over time."
        controls={<TrendControls />}
        chart={<TrendChart points={trends.points} granularity={granularity} />}
        table={<TrendTable points={trends.points} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <Detail label="Email" value={customer.email} />
              <Detail label="Phone" value={customer.phone} />
              <Detail
                label="Location"
                value={[customer.city, customer.country].filter(Boolean).join(', ') || null}
              />
              <Detail
                label="Owner"
                value={customer.runnerUsername ?? customer.managerUsername ?? null}
              />
              <Detail label="Registered" value={formatDate(customer.registeredAt)} />
              <Detail label="Last activity" value={formatDate(customer.lastActivityAt)} />
              <Detail label="Entries" value={formatCount(customer.totalTransactions)} />
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 py-4">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={`/transactions?customerId=${customer.id}`}>View all</Link>
            </Button>
          </CardHeader>

          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Game</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                      No entries recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.data.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDateTime(entry.occurredAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={entry.type === 'debit' ? 'debit' : 'credit'}>
                            {entry.type}
                          </Badge>
                          {entry.isCorrection ? (
                            <Badge variant="outline" title="Corrects an earlier entry">
                              correction
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={entry.amount} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.gameName ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value ?? '—'}</dd>
    </div>
  );
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
