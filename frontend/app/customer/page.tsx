import type { Metadata } from 'next';
import Link from 'next/link';
import { CrownIcon, GiftIcon, MessageSquareIcon, TrophyIcon } from 'lucide-react';

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
import { customerGet } from '@/lib/customer-api';
import { getCustomerActor } from '@/lib/customer-session';
import { formatCount, formatDate } from '@/lib/money';
import type { components } from '@/lib/api-schema';

type CustomerDashboard = components['schemas']['CustomerDashboardDto'];
type VipStatus = components['schemas']['VipStatusDto'];
type MyReferral = components['schemas']['MyReferralDto'];
type RecentWinner = components['schemas']['RecentWinnerDto'];

export const metadata: Metadata = { title: 'Your account' };

export default async function CustomerOverviewPage() {
  const actor = await getCustomerActor();

  /*
   * Fetched together rather than in sequence — they are independent reads
   * and the portal is one screen. Referrals and VIP status are allowed to
   * fail softly: a customer with neither should still see their balance
   * rather than an error page.
   */
  const [dashboard, vip, referral, wins] = await Promise.all([
    customerGet<CustomerDashboard>('/me/dashboard'),
    customerGet<VipStatus>('/me/vip-status').catch(() => null),
    customerGet<MyReferral>('/me/referral').catch(() => null),
    customerGet<RecentWinner[]>('/me/recent-winners', { limit: 5 }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{actor?.fullName ? `, ${actor.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">
          Your balance, activity and messages. Everything here is read-only — the team maintains
          your details for you.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Balance" value={<Money value={dashboard.balance} />} />
        <StatCard
          label="Bonus balance"
          value={<Money value={dashboard.bonusBalance} />}
          hint="Referral bonuses, kept separate from your balance."
        />
        <StatCard
          label="Total deposited"
          value={<Money value={dashboard.totalSpent} />}
          hint={`${formatCount(dashboard.transactionCount)} entries on your record.`}
        />
        <StatCard
          label="Total withdrawn"
          value={<Money value={dashboard.totalWithdrawn} />}
          hint="Excludes corrections to earlier entries."
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CrownIcon className="size-4" />
              VIP standing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.isVip ? (
              <>
                <Badge variant="default">Tier {dashboard.vipTier ?? vip?.currentTier ?? 1}</Badge>
                <p className="text-muted-foreground text-sm">
                  Standing is worked out from your recorded activity — nobody sets it by hand.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Not currently qualifying. VIP standing is computed from your activity over the
                current period.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareIcon className="size-4" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {dashboard.unreadMessages > 0 ? (
                <>
                  You have{' '}
                  <span className="font-semibold">
                    {formatCount(dashboard.unreadMessages)} unread
                  </span>{' '}
                  {dashboard.unreadMessages === 1 ? 'message' : 'messages'}.
                </>
              ) : (
                'No unread messages.'
              )}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/customer/messages">Open messages</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {referral?.code ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GiftIcon className="size-4" />
              Your referral code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <code className="bg-muted tabular inline-block rounded-md px-3 py-2 text-sm">
              {referral.code}
            </code>
            <div className="grid gap-3 sm:grid-cols-3">
              <Figure label="Referred" value={formatCount(referral.totalReferred)} />
              <Figure label="Rewarded" value={formatCount(referral.totalRewarded)} />
              <Figure label="Earned" value={<Money value={referral.totalEarned} />} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrophyIcon className="size-4" />
            Your wins
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {wins.length === 0 ? (
            <p className="text-muted-foreground px-6 py-6 text-center text-sm">
              No wins recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Prize</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Announced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wins.map((win, index) => (
                  <TableRow key={`${win.eventName}-${index}`}>
                    <TableCell className="font-medium">{win.eventName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {win.prizeLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={win.prizeAmount} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(win.announcedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
