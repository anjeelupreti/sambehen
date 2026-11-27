'use client';

/* eslint-disable @next/next/no-img-element -- small static artwork */
import { useState } from 'react';
import { CheckIcon, CopyIcon, Share2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { winAmount } from '@/components/portal/night/format';
import { formatCount, formatMoney } from '@/lib/money';
import type { components } from '@/lib/api-schema';

type MyReferral = components['schemas']['MyReferralDto'];

/** The next friend count worth aiming for: 1, then 5, then every 5 after. */
const nextGoal = (referred: number) => (referred < 1 ? 1 : (Math.floor(referred / 5) + 1) * 5);

/**
 * Inviting friends, led by what each one is worth. Sharing uses the
 * phone's share sheet where there is one, and copies the link otherwise.
 * Codes are issued by staff, so a player without one is told where to get it.
 */
export function ReferralCodeCard({
  referral,
  art,
}: {
  referral: MyReferral | null;
  art?: string | null;
}) {
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

  const share = async (link: string, bonus: string | null) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Howdi',
          text: bonus ? `Join with my invite. We both get rewarded.` : 'Join me on Howdi.',
          url: link,
        });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
    await copy(link);
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
    <section
      aria-labelledby="invite-title"
      className="relative overflow-hidden rounded-2xl border border-gold/20 bg-[radial-gradient(110%_100%_at_100%_0%,rgb(242_193_78/0.16),transparent_60%),var(--card)] p-5"
    >
      {art && (
        <img
          src={art}
          alt=""
          className="pointer-events-none absolute -top-1 -right-2 size-28 sm:size-32"
        />
      )}

      <div className="relative pr-24 sm:pr-28">
        <h2 id="invite-title" className="text-muted-foreground text-sm font-semibold">
          Invite a friend
        </h2>
        {bonus ? (
          <p className="mt-1 leading-tight">
            <span className="text-3xl font-bold text-gold [font-stretch:115%]">
              Get {winAmount(bonus)}
            </span>
            <span className="text-muted-foreground block text-sm">for every friend who joins</span>
          </p>
        ) : (
          <p className="mt-1 text-xl font-bold">Bring your crew</p>
        )}
      </div>

      <div className="relative mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span>
            <span className="font-bold tabular-nums">{formatCount(referred)}</span>
            <span className="text-muted-foreground"> of {formatCount(goal)} joined</span>
          </span>
          <span className="text-muted-foreground text-xs">
            Earned{' '}
            <span className="text-foreground font-semibold">
              {formatMoney(referral.totalEarned)}
            </span>
          </span>
        </div>
        <div
          className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Friends joined toward the next milestone"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={referred}
        >
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#b8862b,#f2c14e)]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {referral.referralLink && (
        <div className="relative mt-5 flex gap-2">
          <Button
            type="button"
            className="flex-1"
            onClick={() => share(referral.referralLink!, bonus)}
          >
            <Share2Icon className="size-4" />
            Share invite
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => copy(referral.referralLink!)}
            aria-label="Copy invite link"
          >
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            <span className="tabular font-semibold">{referral.code}</span>
          </Button>
        </div>
      )}
    </section>
  );
}
