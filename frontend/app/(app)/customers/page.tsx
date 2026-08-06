import type { Metadata } from 'next';
import Link from 'next/link';
import { BuildingIcon, GlobeIcon } from 'lucide-react';

import { ClickableRow } from '@/components/clickable-row';
import { CustomerActions } from '@/components/customer-actions';
import { ImportCustomersModal } from '@/components/customers/import-customers-modal';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
import { SortableHeader } from '@/components/filters/sortable-header';
import { NewCustomerModal } from '@/components/forms/new-customer-modal';
import { TextFilter } from '@/components/filters/text-filter';
import { Money } from '@/components/money';
import { PaginationControls } from '@/components/pagination-controls';
import { ExportButton } from '@/components/export-button';
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
import { getActor } from '@/lib/session';
import type { Customer, CustomerStatus, CustomerSummary, Staff } from '@/lib/types';

export const metadata: Metadata = { title: 'Customers' };

const STATUS_VARIANT: Record<CustomerStatus, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    active: 'default',
    inactive: 'secondary',
    suspended: 'outline',
    banned: 'destructive',
  };

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
];

/**
 * `status` is the stored column; `isActive` is activity-based — status is
 * active AND last seen inside the configured window. They are genuinely
 * different questions, so they get separate controls rather than one
 * merged "active" filter that would answer neither reliably.
 */
const ACTIVITY_OPTIONS = [
  { value: 'true', label: 'Recently active' },
  { value: 'false', label: 'Dormant' },
];

/** Chips describe what is filtered; every one here has a control above. */
const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'status', label: 'Status' },
  { param: 'isActive', label: 'Activity', labels: { true: 'Recent', false: 'Dormant' } },
  { param: 'city', label: 'City' },
  { param: 'country', label: 'Country' },
  { param: 'dateFrom', label: 'From' },
  { param: 'dateTo', label: 'To' },
];

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

  const actor = await getActor();

  // Who a new customer can be assigned to. A runner is never asked, so the
  // list is not fetched for them. Masters and managers see the scoped staff
  // list minus masters, who sit above the chain and cannot own customers.
  const ownersPromise =
    actor && actor.role !== 'runner'
      ? apiList<Staff>('/team/staff', { query: { limit: 100, isActive: true } })
      : null;

  // Filters pass straight through to the API, which validates them and
  // returns 422 on anything it does not accept. There is no second
  // whitelist here — one authority for what a valid filter is.
  const { data, meta, summary } = await apiList<Customer, CustomerSummary>('/team/customers', {
    query: {
      page: first('page') ?? 1,
      limit: 20,
      search: first('search'),
      status: first('status'),
      isActive: first('isActive'),
      city: first('city'),
      country: first('country'),
      dateFrom: first('dateFrom'),
      dateTo: first('dateTo'),
      sortBy: first('sortBy'),
      sortOrder: first('sortOrder'),
    },
  });

  const owners = ownersPromise
    ? (await ownersPromise).data
        .filter((member) => member.role !== 'master')
        .map((member) => ({ id: member.id, username: member.username, role: member.role }))
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">
            Only the customers in your chain. Totals below cover every match, not just this page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton exportKey="customers" />
          {actor ? <ImportCustomersModal actorRole={actor.role} owners={owners} /> : null}
          {actor ? <NewCustomerModal actorRole={actor.role} owners={owners} /> : null}
        </div>
      </header>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Matching" value={formatCount(summary.totalCustomers)} />
          <StatCard
            label="Active"
            value={formatCount(summary.activeCustomers)}
            hint={`${formatCount(summary.inactiveCustomers)} inactive, ${formatCount(summary.suspendedCustomers)} suspended.`}
          />
          <StatCard label="Total balance" value={<Money value={summary.totalBalance} />} />
          <StatCard
            label="Bonus balance"
            value={<Money value={summary.totalBonusBalance} />}
            hint="Referral bonuses, kept separate from real money."
          />
        </section>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search username, name, email…" />
            <FilterSelect param="status" label="Status" options={STATUS_OPTIONS} />
            <FilterSelect
              param="isActive"
              label="Activity"
              options={ACTIVITY_OPTIONS}
              anyLabel="Any activity"
              className="w-[160px]"
            />
            <TextFilter param="city" label="City" icon={<BuildingIcon className="size-4" />} />
            <TextFilter param="country" label="Country" icon={<GlobeIcon className="size-4" />} />
            <DateRangeFilter label="Registered" />
          </FilterBar>

          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="username">Customer</SortableHeader>
                <SortableHeader column="status">Status</SortableHeader>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Withdrawn</TableHead>
                <SortableHeader column="balance" align="right">
                  Net
                </SortableHeader>
                <SortableHeader column="lastActivityAt">Last activity</SortableHeader>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                    No customers match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((customer) => (
                  <ClickableRow key={customer.id} href={`/customers/${customer.id}`}>
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
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(customer.lastActivityAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <CustomerActions customer={customer} />
                    </TableCell>
                  </ClickableRow>
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
