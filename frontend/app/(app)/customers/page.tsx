import type { Metadata } from 'next';
import Link from 'next/link';

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
import { formatCount, formatDate } from '@/lib/money';
import type { Customer, CustomerStatus, CustomerSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Customers' };

const STATUS_VARIANT: Record<CustomerStatus, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    active: 'default',
    inactive: 'secondary',
    suspended: 'outline',
    banned: 'destructive',
  };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // Filters pass straight through to the API, which validates them and
  // returns 422 on anything it does not accept. There is no second
  // whitelist here — one authority for what a valid filter is.
  const { data, meta, summary } = await apiList<Customer, CustomerSummary>('/team/customers', {
    query: {
      page: first('page') ?? 1,
      limit: 20,
      search: first('search'),
      status: first('status'),
      sortBy: first('sortBy'),
      sortOrder: first('sortOrder'),
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">
            Only the customers in your chain. Totals below cover every match, not just this page.
          </p>
        </div>
      </header>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Matching" value={formatCount(summary.totalCustomers)} />
          <StatCard label="Active" value={formatCount(summary.activeCustomers)} />
          <StatCard label="Total spent" value={<Money value={summary.totalSpent} />} />
          <StatCard
            label="Total withdrawn"
            value={<Money value={summary.totalWithdrawn} />}
            hint="Excludes corrections."
          />
        </section>
      ) : null}

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center gap-3 p-3">
            <SearchField placeholder="Search username, name, email…" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Withdrawn</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                    No customers match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {customer.username}
                      </Link>
                      {customer.fullName ? (
                        <p className="text-muted-foreground text-xs">{customer.fullName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[customer.status]} className="capitalize">
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {customer.runnerUsername ?? customer.managerUsername ?? '—'}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatCount(customer.totalTransactions)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={customer.totalSpent} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={customer.totalWithdrawn} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={customer.netBalance} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(customer.lastActivityAt)}
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
