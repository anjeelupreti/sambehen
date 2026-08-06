import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LayoutDashboardIcon, LogOutIcon, MessageSquareIcon, UserIcon } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getCustomerActor } from '@/lib/customer-session';

/**
 * The customer portal shell.
 *
 * Deliberately much smaller than the staff app. A customer can **read**
 * their own record and message the business; they cannot change anything
 * about themselves, including their password — every edit is made by the
 * staff above them. So there is no settings area and no edit affordance
 * anywhere in here, by design rather than omission.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCustomerActor();

  // Middleware already refused anything without a customer session; reaching
  // here without an actor means the cookie is unreadable.
  if (!actor) redirect('/customer/login');

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-2 px-4">
          <Link href="/customer" className="font-semibold tracking-tight">
            Sambehen
          </Link>

          <nav className="flex items-center gap-1" aria-label="Portal">
            <Button asChild variant="ghost" size="sm">
              <Link href="/customer">
                <LayoutDashboardIcon className="size-4" />
                <span className="hidden sm:inline">Overview</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/customer/messages">
                <MessageSquareIcon className="size-4" />
                <span className="hidden sm:inline">Messages</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/customer/profile">
                <UserIcon className="size-4" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
            </Button>

            <ThemeToggle />

            <Button asChild variant="ghost" size="sm" aria-label="Sign out">
              <Link href="/customer/logout">
                <LogOutIcon className="size-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">{children}</main>

      <footer className="text-muted-foreground mx-auto w-full max-w-4xl px-4 pb-6 text-xs">
        Signed in as {actor.username}. To change any of your details, contact the team.
      </footer>
    </div>
  );
}
