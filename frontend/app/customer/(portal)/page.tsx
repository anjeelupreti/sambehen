import type { Metadata } from 'next';

import { ReferralCodeCard } from '@/components/customer/referral-code-card';
import { ActivityList, type MyTransaction } from '@/components/portal/activity-list';
import { BalanceCard } from '@/components/portal/balance-card';
import { LatestMessage } from '@/components/portal/latest-message';
import { VipProgress, type VipCriterion } from '@/components/portal/vip-progress';
import { customerGet } from '@/lib/customer-api';
import { getCustomerActor } from '@/lib/customer-session';
import type { components } from '@/lib/api-schema';
import type { Message } from '@/lib/types';

type CustomerDashboard = components['schemas']['CustomerDashboardDto'];
type VipStatus = components['schemas']['VipStatusDto'];
type MyReferral = components['schemas']['MyReferralDto'];

export const metadata: Metadata = { title: 'Your account' };

/**
 * The player's home: balance first, then where they stand on VIP, their
 * latest message, what was recorded recently, and their referral link.
 * Laid out for a phone first; on wider screens VIP and messages sit side
 * by side.
 */
export default async function CustomerOverviewPage() {
  const actor = await getCustomerActor();

  // Each section degrades on its own: a failed VIP or message request
  // should not take the balance down with it.
  const [dashboard, vip, referral, thread, activity] = await Promise.all([
    customerGet<CustomerDashboard>('/me/dashboard'),
    customerGet<VipStatus>('/me/vip-status').catch(() => null),
    customerGet<MyReferral>('/me/referral').catch(() => null),
    customerGet<{ data: Message[] }>('/me/messages', { limit: 1 }).catch(() => null),
    customerGet<MyTransaction[]>('/me/transactions', { limit: 8 }).catch(() => []),
  ]);

  const firstName = actor?.fullName?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{firstName ? `Hi ${firstName}` : 'Your account'}</h1>

      <BalanceCard
        balance={dashboard.balance}
        bonusBalance={dashboard.bonusBalance}
        moneyIn={dashboard.totalSpent}
        moneyOut={dashboard.totalWithdrawn}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <VipProgress
          // The API documents criteria as a bare object array; this is its
          // real shape (VipStatusDto in the backend).
          criteria={(vip?.criteria ?? []) as unknown as VipCriterion[]}
          rewardsReceived={dashboard.totalWins}
        />
        <LatestMessage message={thread?.data?.[0] ?? null} unread={dashboard.unreadMessages} />
      </div>

      <ActivityList items={activity} total={dashboard.transactionCount} />

      <ReferralCodeCard referral={referral} />
    </div>
  );
}
