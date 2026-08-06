import type { Metadata } from 'next';
import Link from 'next/link';

import { AssignCodesModal } from '@/components/referrals/assign-codes-modal';
import { ReferralProgramModal } from '@/components/referrals/program-modal';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { ExportButton } from '@/components/export-button';
import { FilterBar } from '@/components/filters/filter-bar';
import { FilterSelect } from '@/components/filters/filter-select';
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
import { formatCount, formatDate, formatDateTime } from '@/lib/money';
import { getActor } from '@/lib/session';
import type { components } from '@/lib/api-schema';

type Program = components['schemas']['ReferralProgramResponseDto'];
type Referral = components['schemas']['ReferralResponseDto'];
type ReferralSummary = components['schemas']['ReferralSummaryDto'];

export const metadata: Metadata = { title: 'Referrals' };

/**
 * A referral is pending until the referee actually qualifies, and only then
 * is it rewarded. Showing the two apart matters: a wall of "pending" means
 * the programme is being shared but not converting, which reads very
 * differently from one that is paying out.
 */
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'rewarded', label: 'Rewarded' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  qualified: 'secondary',
  rewarded: 'default',
  rejected: 'destructive',
};

const ACTIVE_FILTERS = [
  { param: 'search', label: 'Search' },
  { param: 'status', label: 'Status' },
  { param: 'programId', label: 'Program' },
  { param: 'dateFrom', label: 'From' },
  { param: 'dateTo', label: 'To' },
];

export default async function ReferralsPage({
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

  // Programs are master-defined, like VIP criteria. Everyone can read the
  // resulting referrals within their own scope.
  const programsPromise =
    actor?.role === 'master'
      ? apiList<Program>('/team/referral-programs', { query: { limit: 50 } })
      : null;

  const { data, meta, summary } = await apiList<Referral, ReferralSummary>('/team/referrals', {
    query: {
      page: first('page') ?? 1,
      limit: 20,
      search: first('search'),
      status: first('status'),
      programId: first('programId'),
      dateFrom: first('dateFrom'),
      dateTo: first('dateTo'),
      sortBy: first('sortBy'),
      sortOrder: first('sortOrder'),
    },
  });

  const programs = programsPromise ? (await programsPromise).data : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
          <p className="text-muted-foreground text-sm">
            Programs define the reward, codes are issued to customers under them, and the ledger
            below is what those codes produced. Bonuses are tracked apart from real money.
          </p>
        </div>
        <ExportButton exportKey="referrals" />
      </header>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Referrals" value={formatCount(summary.totalReferrals)} />
          <StatCard
            label="Pending"
            value={formatCount(summary.pending)}
            hint="Shared, but the referee has not qualified yet."
          />
          <StatCard label="Rewarded" value={formatCount(summary.rewarded)} />
          <StatCard
            label="Total paid"
            value={<Money value={summary.totalRewarded} />}
            hint="Bonus balance, not withdrawable cash."
          />
        </section>
      ) : null}

      {/* Programs above the ledger they produce — the same shape as criteria
          above VIPs and events above winners. */}
      {actor?.role === 'master' ? <ProgramsSection programs={programs} /> : null}

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <FilterBar active={ACTIVE_FILTERS}>
            <SearchField placeholder="Search referrer or referee…" />
            <FilterSelect param="status" label="Status" options={STATUS_OPTIONS} />
            <DateRangeFilter label="Referred" />
          </FilterBar>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Referee</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Referrer earns</TableHead>
                <TableHead className="text-right">Referee earns</TableHead>
                <TableHead>Referred</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                    No referrals match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${referral.referrerCustomerId}`}
                        className="font-medium hover:underline"
                      >
                        {referral.referrerUsername ?? '—'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${referral.refereeCustomerId}`}
                        className="font-medium hover:underline"
                      >
                        {referral.refereeUsername ?? '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {referral.programName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[referral.status] ?? 'outline'}>
                        {referral.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={referral.referrerReward} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={referral.refereeReward} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDateTime(referral.createdAt)}
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

function ProgramsSection({ programs }: { programs: Program[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div>
            <h2 className="text-sm font-semibold">Referral programs</h2>
            <p className="text-muted-foreground text-xs">
              What each side earns, and for how long. Issue codes to customers from here.
            </p>
          </div>
          <ReferralProgramModal />
        </div>

        {programs.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No programs yet. Nothing can be referred until one exists.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead className="text-right">Referrer</TableHead>
                <TableHead className="text-right">Referee</TableHead>
                <TableHead className="text-right">Codes</TableHead>
                <TableHead>Valid</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-40">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell className="font-medium">{program.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm capitalize">
                    {program.rewardType}
                  </TableCell>
                  <TableCell className="text-right">
                    {program.rewardType === 'percentage' ? (
                      <span className="tabular">{program.referrerBonus}%</span>
                    ) : (
                      <Money value={program.referrerBonus} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {program.rewardType === 'percentage' ? (
                      <span className="tabular">{program.refereeBonus}%</span>
                    ) : (
                      <Money value={program.refereeBonus} />
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatCount(program.issuedCodes ?? 0)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(program.validFrom)} –{' '}
                    {program.validTo ? formatDate(program.validTo) : 'open'}
                  </TableCell>
                  <TableCell>
                    {/* `isCurrentlyValid` is the one that matters: a program
                        can be active but outside its date window, which is
                        not the same as switched off. */}
                    {program.isCurrentlyValid ? (
                      <Badge variant="default">Running</Badge>
                    ) : program.isActive ? (
                      <Badge variant="outline" title="Active, but outside its date window">
                        Out of window
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <AssignCodesModal programId={program.id} programName={program.name} />
                      <ReferralProgramModal program={program} />
                    </div>
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
