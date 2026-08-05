import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getAccessToken } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in · Sambehen' };

export default async function LoginPage() {
  /*
   * Keyed on the access token, never on the actor cookie.
   *
   * The actor cookie outlives the access token by a week, so redirecting on
   * its presence sent people to /dashboard with no way to call the API —
   * which bounced them back here, several times a second. Middleware has
   * already tried to refresh by the time this renders, so a missing access
   * token here means there is genuinely no session to resume.
   */
  if (await getAccessToken()) redirect('/dashboard');

  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-zinc-950 text-zinc-50 p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-zinc-950 to-zinc-950" />
        <div className="relative z-10 flex items-center gap-2">
          <div className="size-8 rounded-md bg-indigo-600 grid place-items-center font-bold text-lg">
            S
          </div>
          <span className="text-xl font-bold tracking-tight">Sambehen</span>
        </div>
        <div className="relative z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;The premier management dashboard for your business operations.&rdquo;
            </p>
            <footer className="text-sm text-zinc-400">Staff Portal</footer>
          </blockquote>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access the dashboard.
            </p>
          </div>
          <LoginForm />
          <p className="text-center text-xs text-muted-foreground lg:text-left">
            Customers should sign in through the{' '}
            <a href="/customer/login" className="underline underline-offset-4 hover:text-primary">
              customer portal
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
