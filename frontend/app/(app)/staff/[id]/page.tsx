import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';

import { Money } from '@/components/money';
import { StaffActions } from '@/components/staff-actions';
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
import { formatCount, formatDate } from '@/lib/money';
import type { Customer, CustomerSummary, Staff } from '@/lib/types';

export const metadata: Metadata = { title: 'Staff member' };

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let member: Staff;
  try {
    member = await apiGet<Staff>(`/team/staff/${id}`);
  } catch (error) {
    // 404 here may mean the member does not exist, or belongs to another
    // manager's chain. The API makes those indistinguishable on purpose, so
    // this says "not found" for both rather than confirming existence.
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // Their book of business. `runnerId` for a runner, `managerId` for a
  // manager — the API scopes each to the right side of the chain.
  const customers = await apiList<Customer, CustomerSummary>('/team/customers', {
    query: {
      limit: 10,
      ...(member.role === 'runner' ? { runnerId: member.id } : { managerId: member.id }),
    },
  });

  const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/staff">
            <ArrowLeftIcon className="size-4" />
            All staff
          </Link>
        </Button>

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{member.username}</h1>
              <Badge variant="secondary" className="capitalize">
                {member.role}
              </Badge>
              {member.isActive ? (
                <Badge variant="default">Active</Badge>
              ) : (
                <Badge variant="outline">Deactivated</Badge>
              )}
            </div>
            {fullName ? <p className="text-muted-foreground text-sm">{fullName}</p> : null}
          </div>

          {/* A master can act on anyone; a manager only on their own runners,
              which is what the API allows too. */}
          {member.role === 'master' ? null : <StaffActions staff={member} hideView />}
        </header>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customers" value={formatCount(customers.summary?.totalCustomers ?? 0)} />
        <StatCard
          label="Active"
          value={formatCount(customers.summary?.activeCustomers ?? 0)}
          hint="Active within the configured activity window."
        />
        <StatCard
          label="Total balance"
          value={<Money value={customers.summary?.totalBalance ?? '0'} />}
        />
        <StatCard
          label="Bonus balance"
          value={<Money value={customers.summary?.totalBonusBalance ?? '0'} />}
          hint="Referral bonuses, kept separate from real money."
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <Detail label="Email" value={member.email} />
              <Detail label="Phone" value={member.phone} />
              <Detail label="Role" value={member.role} />
              <Detail
                label="Last sign-in"
                value={member.lastLoginAt ? formatDate(member.lastLoginAt) : 'Never'}
              />
              <Detail label="Created" value={formatDate(member.createdAt)} />
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 py-4">
            <CardTitle className="text-base">Their customers</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/customers?${member.role === 'runner' ? 'runnerId' : 'managerId'}=${member.id}`}
              >
                View all
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                      No customers assigned yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.data.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-medium hover:underline"
                        >
                          {customer.username}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={customer.totalSpent} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(customer.lastActivityAt)}
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
      <dd className="min-w-0 truncate text-right font-medium capitalize">{value ?? '—'}</dd>
    </div>
  );
}
