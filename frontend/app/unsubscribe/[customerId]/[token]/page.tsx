import type { Metadata } from 'next';
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Unsubscribe' };

/**
 * The page an unsubscribe footer lands on.
 *
 * Public and unauthenticated by design: someone clicking this from an email
 * has no session, and requiring one would make the link useless — which is
 * the whole point of an opt-out.
 *
 * The request is made from the server rather than the browser so the link
 * works with images and scripts disabled, which is how a lot of mail is
 * read. It is a GET the API treats as the action itself; the token in the
 * URL is what authorises it.
 *
 * Only marketing mail is affected. Account and security messages carry no
 * opt-out link and keep sending, which the copy below says plainly so
 * nobody expects this to stop a password-reset email.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ customerId: string; token: string }>;
}) {
  const { customerId, token } = await params;

  let ok = false;
  let message = 'That unsubscribe link is not valid or has already been used.';

  try {
    const response = await fetch(
      `${API_URL}${API_PREFIX}/public/unsubscribe/${encodeURIComponent(customerId)}/${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );

    ok = response.ok;
    if (!ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      // A 429 is rate limiting, not a bad link — say so rather than
      // implying the link is broken.
      message =
        response.status === 429
          ? 'Too many attempts. Please try again in a moment.'
          : (payload?.error?.message ?? message);
    }
  } catch {
    message = 'We could not reach the service. Please try again shortly.';
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {ok ? (
              <CheckCircle2Icon className="size-5 text-green-600 dark:text-green-500" />
            ) : (
              <XCircleIcon className="text-destructive size-5" />
            )}
            {ok ? 'You have been unsubscribed' : 'Unsubscribe failed'}
          </CardTitle>
          <CardDescription>
            {ok ? 'You will not receive marketing email from us again.' : message}
          </CardDescription>
        </CardHeader>

        {ok ? (
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Account and security messages — things like a password change or a problem with your
              account — are not marketing and will still reach you. To change anything else about
              your record, contact the team.
            </p>
          </CardContent>
        ) : null}
      </Card>
    </main>
  );
}
