import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getActor } from '@/lib/session';
import { CustomerLoginForm } from './customer-login-form';

export const metadata: Metadata = { title: 'Customer Sign in · Sambehen' };

export default async function CustomerLoginPage() {
  if (await getActor()) redirect('/dashboard');

  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your customer account to view your details.
            </p>
          </div>
          <CustomerLoginForm />
          <p className="text-center text-xs text-muted-foreground lg:text-left">
            Staff members should sign in through the{' '}
            <a href="/login" className="underline underline-offset-4 hover:text-primary">
              staff portal
            </a>
            .
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-col justify-between bg-primary/5 text-primary-foreground p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tl from-primary/20 via-background to-background" />
        <div className="relative z-10 flex items-center gap-2 justify-end text-foreground">
          <span className="text-xl font-bold tracking-tight">Sambehen</span>
          <div className="size-8 rounded-md bg-primary grid place-items-center font-bold text-lg text-primary-foreground">
            C
          </div>
        </div>
        <div className="relative z-10 mt-auto text-foreground text-right">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;Track your transactions and view your account securely.&rdquo;
            </p>
            <footer className="text-sm text-muted-foreground">Customer Portal</footer>
          </blockquote>
        </div>
      </div>
    </main>
  );
}
