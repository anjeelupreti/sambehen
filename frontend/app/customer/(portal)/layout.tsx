import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';

import { LiveUnreadProvider } from '@/components/customer/live-unread';
import { PortalBottomNav, PortalTopNav } from '@/components/customer/portal-nav';
import { NightMode } from '@/components/portal/night/night-mode';
import { WinPop } from '@/components/portal/win-pop';
import { publicAsset } from '@/lib/public-asset';
import { slab } from '@/lib/fonts';
import { customerGet } from '@/lib/customer-api';
import { Button } from '@/components/ui/button';
import { getCustomerActor } from '@/lib/customer-session';
import { SkipLink } from '@/components/skip-link';
import { ChatSocketProvider } from '@/components/chat/socket';
import { Logo } from '@/components/logo';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { AppPrompts } from '@/components/pwa/app-prompts';

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

  const unread = await customerGet<{ unreadCount: number }>('/me/messages/unread-count')
    .then((result) => result.unreadCount)
    .catch(() => 0);

  return (
    <ChatSocketProvider realm="customer">
      <LiveUnreadProvider initial={unread}>
        {/* Before first paint, so the portal never flashes the light theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('night');",
          }}
        />
        <NightMode />
        <div className={`${slab.variable} flex min-h-svh flex-col`}>
          <SkipLink />
          <header className="bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4 sm:px-6">
              <Link href="/customer" className="rounded">
                <Logo />
              </Link>

              <PortalTopNav />

              <div className="flex items-center gap-1">
                <NotificationBell realm="customer" />
                {/* A plain <a>, not <Link>: production Next.js prefetches visible
                links, and prefetching this route runs it, which clears the
                session cookies the moment any portal page renders. */}
                <Button asChild variant="ghost" size="sm" aria-label="Sign out">
                  <a href="/customer/logout">
                    <LogOutIcon className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-3xl flex-1 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-10"
          >
            {children}
          </main>

          <AppPrompts
            realm="customer"
            className="bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6"
          />
          <WinPop art={publicAsset('brand/mascot/trophy.webp')} />
          <PortalBottomNav />
        </div>
      </LiveUnreadProvider>
    </ChatSocketProvider>
  );
}
