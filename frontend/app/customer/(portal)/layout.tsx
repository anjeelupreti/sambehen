import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LayoutDashboardIcon, LogOutIcon, MessageSquareIcon, UserIcon } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getCustomerActor } from '@/lib/customer-session';
import { SkipLink } from '@/components/skip-link';
import { ChatSocketProvider } from '@/components/chat/socket';
import { Logo } from '@/components/logo';

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
  if (!actor) redirect('/login');

  return (
    <ChatSocketProvider realm="customer">
      <div className="flex min-h-svh flex-col">
        <SkipLink />
        <header className="bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4 sm:px-6">
            <Link href="/customer" className="rounded">
              <Logo />
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

              {/* A plain <a>, not <Link>: production Next.js prefetches visible
                links, and prefetching this route runs it, which clears the
                session cookies the moment any portal page renders. */}
              <Button asChild variant="ghost" size="sm" aria-label="Sign out">
                <a href="/customer/logout">
                  <LogOutIcon className="size-4" />
                </a>
              </Button>
            </nav>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 p-4 pb-10 sm:p-6">
          {children}
        </main>
      </div>
    </ChatSocketProvider>
  );
}
