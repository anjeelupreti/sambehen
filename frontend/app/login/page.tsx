import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { getCustomerAccessToken } from '@/lib/customer-session';
import { getAccessToken } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * The single sign-in for staff and players. The API works out which kind
 * of account the credentials belong to, so nobody has to know which door
 * is theirs.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  if (await getAccessToken()) redirect('/dashboard');
  if (await getCustomerAccessToken()) redirect('/customer');

  const { from = '' } = await searchParams;

  return (
    <AuthShell art="closing.png">
      <h1 className="text-3xl font-extrabold tracking-[-0.01em] [font-stretch:118%]">Sign in</h1>

      <div className="mt-8">
        <LoginForm from={from} />
      </div>

      <p className="text-lp-dim mt-8 text-sm">
        New player?{' '}
        <Link
          href="/register"
          className="text-lp-primary focus-visible:outline-lp-primary rounded font-medium hover:underline focus-visible:outline-2"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
