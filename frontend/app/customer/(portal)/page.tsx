/* eslint-disable @next/next/no-img-element -- small static artwork */
import type { Metadata } from 'next';

import { ReferralCodeCard } from '@/components/customer/referral-code-card';
import { ActivityList, type MyTransaction } from '@/components/portal/activity-list';
import { BalanceCard } from '@/components/portal/balance-card';
import { PlayResponsibly } from '@/components/portal/play-responsibly';
import { SpinCountdown } from '@/components/portal/spin-countdown';
import { WinsTicker } from '@/components/portal/wins-ticker';
import { LatestMessage } from '@/components/portal/latest-message';
import { Milestones, type Milestone } from '@/components/portal/milestones';
import { TierJourney, type VipCriterion } from '@/components/portal/tier-journey';
import { customerGet } from '@/lib/customer-api';
import { getCustomerActor } from '@/lib/customer-session';
import { publicAsset } from '@/lib/public-asset';
import type { components } from '@/lib/api-schema';
import type { Message } from '@/lib/types';

type CustomerDashboard = components['schemas']['CustomerDashboardDto'];
type VipStatus = components['schemas']['VipStatusDto'];
type MyReferral = components['schemas']['MyReferralDto'];
type WinFeed = components['schemas']['WinFeedDto'];
type MySpinEvent = components['schemas']['MySpinEventDto'];

export const metadata: Metadata = { title: 'Your account' };

const BADGE_KEYS = [
  'joined',
  'first_message',
  'first_referral',
  'five_referrals',
  'vip',
  'three_months',
  'six_months',
  'one_year',
];

/**
 * The player's home: a hello, the balance, where they are on the VIP
 * route, their latest message, milestones, inviting friends and recent
 * activity. Phone first; VIP and messages sit side by side on wider
 * screens.
 *
 * Mascot and badge artwork are optional slots: each renders once its file
 * is in public/brand/.
 */
export default async function CustomerOverviewPage() {
  const actor = await getCustomerActor();

  // Each section degrades on its own: a failed VIP or message request
  // should not take the balance down with it.
  const [dashboard, vip, referral, thread, activity, milestones, wins, spins] = await Promise.all([
    customerGet<CustomerDashboard>('/me/dashboard'),
    customerGet<VipStatus>('/me/vip-status').catch(() => null),
    customerGet<MyReferral>('/me/referral').catch(() => null),
    customerGet<{ data: Message[] }>('/me/messages', { limit: 1 }).catch(() => null),
    customerGet<MyTransaction[]>('/me/transactions', { limit: 8 }).catch(() => []),
    customerGet<Milestone[]>('/me/milestones').catch(() => [] as Milestone[]),
    customerGet<WinFeed>('/me/wins').catch(() => null),
    customerGet<MySpinEvent[]>('/me/spin-events').catch(() => [] as MySpinEvent[]),
  ]);

  const firstName = actor?.fullName?.trim().split(/\s+/)[0];
  const waving = publicAsset('brand/mascot/waving.webp');
  const badgeArt = Object.fromEntries(
    BADGE_KEYS.map((key) => [key, publicAsset(`brand/badges/${key}.webp`)]),
  );

  return (
    <div className="space-y-4">
      {wins && wins.recent.length > 0 && (
        <WinsTicker
          initial={wins.recent}
          className="-mx-4 -mt-4 mb-4 md:mx-0 md:mt-0 md:rounded-xl md:border"
        />
      )}

      <div className="flex items-center gap-3">
        {waving && <img src={waving} alt="" className="-my-2 size-16 shrink-0" />}
        <h1 className="text-2xl font-bold [font-stretch:115%]">
          {firstName ? `Howdy, ${firstName}` : 'Howdy'}
        </h1>
      </div>

      <BalanceCard
        balance={dashboard.balance}
        bonusBalance={dashboard.bonusBalance}
        moneyIn={dashboard.totalSpent}
        moneyOut={dashboard.totalWithdrawn}
      />

      {spins[0] && <SpinCountdown event={spins[0]} art={publicAsset('brand/mascot/spin.webp')} />}

      <div className="grid gap-4 md:grid-cols-2">
        <TierJourney
          // The API documents criteria as a bare object array; this is its
          // real shape (VipStatusDto in the backend).
          criteria={(vip?.criteria ?? []) as unknown as VipCriterion[]}
          trophyArt={publicAsset('brand/mascot/trophy.webp')}
        />
        <LatestMessage message={thread?.data?.[0] ?? null} unread={dashboard.unreadMessages} />
      </div>

      <ReferralCodeCard referral={referral} art={publicAsset('brand/mascot/friends.webp')} />

      {milestones.length > 0 && <Milestones milestones={milestones} art={badgeArt} />}

      <ActivityList
        items={activity}
        total={dashboard.transactionCount}
        emptyArt={publicAsset('brand/mascot/resting.webp')}
      />

      <PlayResponsibly />
    </div>
  );
}
