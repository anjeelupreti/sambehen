import type { Metadata } from 'next';
import Link from 'next/link';

import { AmountRangeFilter } from '@/components/filters/amount-range-filter';
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
import type { Transaction, TransactionSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Transactions' };

const TYPE_OPTIONS = [
  { value: 'debit', label: 'Debit (in)' },
  { value: 'credit', label: 'Credit (out)' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'reversed', label: 'Reversed' },
];

/**
 * Corrections and withdrawals are separate API filters because they answer
 * separate questions: `isCorrection` is a credit WITH a parent, and
 * `isWithdrawal` is a credit with NO parent. Offering one combined control
 * would force the user to guess which one it meant.
 */
const NATURE_OPTIONS = [
  { value: 'withdrawals', label: 'Withdrawals only' },
  { value: 'corrections', label: 'Corrections only' },
  { value: 'excludeCorrections', label: 'Exclude corrections' },
];

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'type', label: 'Type' },
  { param: 'status', label: 'Status' },
  { param: 'nature', label: 'Nature' },
  { param: 'minAmount', label: 'Min' },
  { param: 'maxAmount', label: 'Max' },
  { param: 'dateFrom', label: 'From' },
  { param: 'dateTo', label: 'To' },
  { param: 'customerId', label: 'Customer' },
];

/** Maps the single "nature" control onto the two booleans the API takes. */
function natureToQuery(nature: string | undefined) {
  switch (nature) {
    case 'withdrawals':
      return { isWithdrawal: 'true', isCorrection: undefined };
    case 'corrections':
      return { isWithdrawal: undefined, isCorrection: 'true' };
    case 'excludeCorrections':
      return { isWithdrawal: undefined, isCorrection: 'false' };
    default:
      return { isWithdrawal: undefined, isCorrection: undefined };
  }
}

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

  const nature = natureToQuery(first('nature'));

  const { data, meta, summary } = await apiList<Transaction, TransactionSummary>(
    '/team/transactions',
    {
      query: {
        page: first('page') ?? 1,
        limit: 25,
        search: first('search'),
        type: first('type'),
        status: first('status'),
        customerId: first('customerId'),
        gameId: first('gameId'),
        minAmount: first('minAmount'),
        maxAmount: first('maxAmount'),
        dateFrom: first('dateFrom'),
        dateTo: first('dateTo'),
        sortBy: first('sortBy'),
        sortOrder: first('sortOrder'),
        ...nature,
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
          <StatCard label="Entries" value={formatCount(summary.totalCount)} />
          <StatCard label="Debit" value={<Money value={summary.totalIn} />} hint="Money in." />
          <StatCard
            label="Credit"
            value={<Money value={summary.totalOut} />}
            hint="Money out, excluding corrections."
          />
          <StatCard
            label="Corrections"
            value={<Money value={summary.correctionTotal} />}
            hint={`${formatCount(summary.correctionCount)} fixes to earlier entries, not withdrawals.`}
          />
        </section>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search customer, reference, note…" />
            <FilterSelect param="type" label="Type" options={TYPE_OPTIONS} />
            <FilterSelect param="status" label="Status" options={STATUS_OPTIONS} />
            <FilterSelect
              param="nature"
              label="Nature"
              options={NATURE_OPTIONS}
              anyLabel="All entries"
              className="w-[180px]"
            />
            <AmountRangeFilter />
            <DateRangeFilter label="Occurred" />
          </FilterBar>

          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="occurredAt">When</SortableHeader>
                <TableHead>Customer</TableHead>
                <SortableHeader column="type">Type</SortableHeader>
                <SortableHeader column="amount" align="right">
                  Amount
                </SortableHeader>
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
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDateTime(entry.occurredAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.customerUsername ? (
                        <Link href={`/customers/${entry.customerId}`} className="hover:underline">
                          {entry.customerUsername}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
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
