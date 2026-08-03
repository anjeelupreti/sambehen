import type { Metadata } from 'next';

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
import type { Transaction, TransactionSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Transactions' };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const { data, meta, summary } = await apiList<Transaction, TransactionSummary>(
    '/team/transactions',
    {
      query: {
        page: first('page') ?? 1,
        limit: 25,
        search: first('search'),
        type: first('type'),
        customerId: first('customerId'),
        dateFrom: first('dateFrom'),
        dateTo: first('dateTo'),
      },
    },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">
          Debit is money in, credit is money out. A credit against a parent entry is a correction,
          and is counted separately from a withdrawal.
        </p>
      </header>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Entries" value={formatCount(summary.totalTransactions)} />
          <StatCard label="Debit" value={<Money value={summary.totalDebit} />} hint="Money in." />
          <StatCard
            label="Credit"
            value={<Money value={summary.totalCredit} />}
            hint="Money out, excluding corrections."
          />
          <StatCard
            label="Corrections"
            value={<Money value={summary.totalCorrections} />}
            hint="Fixes to earlier entries, not withdrawals."
          />
        </section>
      ) : null}

      <Card className="py-0">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center gap-3 p-3">
            <SearchField placeholder="Search customer, reference, note…" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Game</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Entered by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                    No transactions match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(entry.occurredAt)}
                    </TableCell>
                    <TableCell className="font-medium">{entry.customerUsername ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={entry.type === 'debit' ? 'debit' : 'credit'}>
                          {entry.type}
                        </Badge>
                        {/*
                          Marked explicitly rather than folded into the type,
                          because a correction that reads as a withdrawal is
                          the single easiest way to misreport this data.
                        */}
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
                    <TableCell className="text-muted-foreground text-sm">
                      {entry.referenceNo ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {entry.enteredByUsername ?? '—'}
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
