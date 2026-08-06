import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GiftIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/money';

export const metadata: Metadata = { title: "You've been referred" };

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

interface PublicReferral {
  code: string;
  programName: string;
  refereeBonus: string;
  minQualifyingDebit: string;
  isValid: boolean;
}

/**
 * Where a referral link lands. Public and unauthenticated — whoever clicks
 * it has no account yet, which is the entire point of the link.
 *
 * There is no self-signup here: every customer account is created by staff
 * (see the "New customer" form), never by the person themselves. So this
 * page states the offer and the code rather than pretending to be a signup
 * form — the code is what the visitor hands the team, and creating the
 * account with that code attached is what actually attributes the referral.
 */
export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${API_PREFIX}/public/referral/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
  } catch {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Could not load this link</CardTitle>
            <CardDescription>Please try again shortly.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  // notFound() throws a Next.js control-flow signal, so it has to happen
  // outside any try/catch here — a catch above would swallow it and this
  // page would render as if the code simply did not resolve.
  if (response.status === 404) notFound();

  const rateLimited = response.status === 429;
  const referral: PublicReferral | null = response.ok
    ? ((await response.json()) as { data: PublicReferral }).data
    : null;

  if (!rateLimited && !referral) notFound();

  if (rateLimited) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Too many attempts</CardTitle>
            <CardDescription>Please try this link again in a moment.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  // Unreachable: the only way to get here with a null referral is
  // rateLimited, which already returned above.
  if (!referral) notFound();

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GiftIcon className="size-5" />
            You&apos;ve been referred
          </CardTitle>
          <CardDescription>
            Someone invited you to {referral.programName}.{' '}
            {referral.isValid ? (
              "Here's what's on offer."
            ) : (
              <span className="text-destructive">
                This link is no longer active — it may have expired or been fully claimed.
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-muted flex items-center justify-between rounded-md px-3 py-2">
            <span className="text-muted-foreground text-sm">You receive</span>
            <span className="text-lg font-semibold">
              <Money value={referral.refereeBonus} />
            </span>
          </div>

          <p className="text-muted-foreground text-sm">
            Earned after you deposit at least <Money value={referral.minQualifyingDebit} /> — a
            bonus balance, kept separate from real money.
          </p>

          {referral.isValid ? (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm">
                Accounts here are set up by the team, not self-registered. Give them this code when
                they create yours, so the referral is recorded:
              </p>
              <div className="flex items-center justify-center">
                <Badge variant="secondary" className="tabular px-3 py-1.5 text-base">
                  {referral.code}
                </Badge>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
