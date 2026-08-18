import type { Metadata } from 'next';

import { ClickableRow } from '@/components/clickable-row';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
import { ExportButton } from '@/components/export-button';
import { SortableHeader } from '@/components/filters/sortable-header';
import { NewStaffModal } from '@/components/forms/new-staff-modal';
import { PaginationControls } from '@/components/pagination-controls';
import { SearchField } from '@/components/search-field';
import { StaffActions } from '@/components/staff-actions';
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
import { formatDate } from '@/lib/money';
import { getActor } from '@/lib/session';
import type { Staff } from '@/lib/types';

export const metadata: Metadata = { title: 'Staff' };

const ROLE_OPTIONS = [
  { value: 'master', label: 'Master' },
  { value: 'manager', label: 'Manager' },
  { value: 'store', label: 'Store' },
];

const STATE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Deactivated' },
];

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'role', label: 'Role' },
  { param: 'isActive', label: 'State', labels: { true: 'Active', false: 'Deactivated' } },
  { param: 'dateFrom', label: 'From' },
  { param: 'dateTo', label: 'To' },
];

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();

  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // Parent options for the create form. Fetched separately from the table:
  // reading them off the current page would empty the list the moment
  // someone filters to stores, leaving a required select with no choices.
  const managersPromise =
    actor?.role === 'master'
      ? apiList<Staff>('/team/staff', { query: { role: 'manager', isActive: true, limit: 100 } })
      : null;

  const { data, meta } = await apiList<Staff>('/team/staff', {
    query: {
      page: first('page') ?? 1,
      limit: 20,
      search: first('search'),
      role: first('role'),
      isActive: first('isActive'),
      dateFrom: first('dateFrom'),
      dateTo: first('dateTo'),
      sortBy: first('sortBy'),
      sortOrder: first('sortOrder'),
    },
  });

  const managers = managersPromise
    ? (await managersPromise).data.map((member) => ({
        id: member.id,
        username: member.username,
      }))
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-muted-foreground text-sm">
            {actor?.role === 'master'
              ? 'Every manager and store.'
              : 'Your own stores. Other managers and their chains are not visible.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton exportKey="staff" />
          {actor ? <NewStaffModal actorRole={actor.role} managers={managers} /> : null}
        </div>
      </header>

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search username, name, email…" />
            <FilterSelect param="role" label="Role" options={ROLE_OPTIONS} />
            <FilterSelect
              param="isActive"
              label="State"
              options={STATE_OPTIONS}
              anyLabel="Any state"
            />
            <DateRangeFilter label="Created" />
          </FilterBar>

          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="username">Member</SortableHeader>
                <SortableHeader column="role">Role</SortableHeader>
                <TableHead>Email</TableHead>
                <SortableHeader column="isActive">State</SortableHeader>
                <SortableHeader column="lastLoginAt">Last sign-in</SortableHeader>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                    No staff match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((member) => {
                  const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ');

                  return (
                    <ClickableRow key={member.id} href={`/staff/${member.id}`}>
                      <TableCell>
                        <span className="font-medium">{member.username}</span>
                        {fullName ? (
                          <p className="text-muted-foreground text-xs">{fullName}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        {member.isActive ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="outline">Deactivated</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {member.lastLoginAt ? formatDate(member.lastLoginAt) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* A master can act on anyone; a manager only on their
                            own stores, which is also what the API allows. */}
                        {member.role === 'master' ? null : <StaffActions staff={member} />}
                      </TableCell>
                    </ClickableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <PaginationControls meta={meta} />
        </CardContent>
      </Card>
    </div>
  );
}
