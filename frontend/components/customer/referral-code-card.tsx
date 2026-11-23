'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatCount, formatMoney } from '@/lib/money';
import type { components } from '@/lib/api-schema';

type MyReferral = components['schemas']['MyReferralDto'];

/** The next friend count worth aiming for: 1, then 5, then every 5 after. */
const nextGoal = (referred: number) => (referred < 1 ? 1 : (Math.floor(referred / 5) + 1) * 5);

/**
 * Inviting friends, framed as a goal: how many have joined, the next
 * milestone, what each one earns, and the link to send. Codes are issued
 * by staff, so a player without one is told where to get it.
 */
export function ReferralCodeCard({ referral }: { referral: MyReferral | null }) {
  const [copied, setCopied] = useState(false);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Link copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the text manually.');
    }
  };

  if (!referral?.code) {
    return (
      <section aria-labelledby="invite-title" className="bg-card rounded-2xl border p-5">
        <h2 id="invite-title" className="text-base font-semibold">
          Invite friends
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">Ask your store for an invite link.</p>
      </section>
    );
  }

  const referred = referral.totalReferred;
  const goal = nextGoal(referred);
  const percent = Math.round((referred / goal) * 100);
  const bonus =
    referral.referrerBonus && Number(referral.referrerBonus) > 0 ? referral.referrerBonus : null;

  return (
    <section aria-labelledby="invite-title" className="bg-card rounded-2xl border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="invite-title" className="text-base font-semibold">
          Invite friends
        </h2>
        {bonus && (
          <span className="text-success text-sm font-semibold">{formatMoney(bonus)} each</span>
        )}
      </div>

      <p className="mt-4 text-sm">
        <span className="text-2xl font-bold tabular-nums [font-stretch:115%]">
          {formatCount(referred)}
        </span>
        <span className="text-muted-foreground"> of {formatCount(goal)} friends joined</span>
      </p>
      <div
        className="bg-muted mt-2 h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Friends joined toward the next milestone"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={referred}
      >
        <div className="bg-success h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>

      {referral.referralLink && (
        <div className="mt-5 flex items-center gap-2">
          <code className="bg-muted tabular min-w-0 flex-1 truncate rounded-lg px-3 py-2.5 text-sm">
            {referral.referralLink}
          </code>
          <Button type="button" className="shrink-0" onClick={() => copy(referral.referralLink!)}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      )}

      <dl className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <div className="flex gap-1">
          <dt>Code</dt>
          <dd className="text-foreground tabular font-medium">{referral.code}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Earned</dt>
          <dd className="text-foreground tabular font-medium">
            {formatMoney(referral.totalEarned)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
