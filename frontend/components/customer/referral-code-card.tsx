'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon, GiftIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/money';
import { formatCount } from '@/lib/money';
import type { components } from '@/lib/api-schema';

type MyReferral = components['schemas']['MyReferralDto'];

/**
 * Where a customer finds their referral link and what to do with it.
 *
 * Before this, the whole card was omitted for anyone without a code —
 * which reads as the feature not existing at all rather than something
 * they simply haven't been given yet. Codes are issued by staff, not
 * self-served (matching the rest of the portal: nothing here is
 * self-editable), so the empty state says that plainly instead of the
 * card just being absent.
 *
 * Once a code exists, the point is the *link* — a bare code means nothing
 * to type into. The link is what gets copied and sent to a friend, so it
 * is what is shown and copied, with the code underneath for anyone who
 * was told the code directly instead.
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GiftIcon className="size-4" />
            Referrals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            You don&apos;t have a referral link yet — the team sets these up. Ask them for one and
            you&apos;ll both earn a bonus when someone you refer signs up and deposits.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GiftIcon className="size-4" />
          Your referral link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Share this with a friend. When they sign up through it and make a qualifying deposit, you
          both earn a bonus under {referral.programName ?? 'the current program'}.
        </p>

        {referral.referralLink ? (
          <div className="flex items-center gap-2">
            <code className="bg-muted tabular flex-1 truncate rounded-md px-3 py-2 text-sm">
              {referral.referralLink}
            </code>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="shrink-0"
              aria-label="Copy referral link"
              onClick={() => copy(referral.referralLink!)}
            >
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            </Button>
          </div>
        ) : null}

        <p className="text-muted-foreground text-xs">
          Or give them the code directly:{' '}
          <code className="bg-muted tabular rounded px-1.5 py-0.5">{referral.code}</code>
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Figure label="Referred" value={formatCount(referral.totalReferred)} />
          <Figure label="Rewarded" value={formatCount(referral.totalRewarded)} />
          <Figure label="Earned" value={<Money value={referral.totalEarned} />} />
        </div>
      </CardContent>
    </Card>
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
