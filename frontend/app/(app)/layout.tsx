import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { Separator } from '@/components/ui/separator';
import { getActor } from '@/lib/session';

/**
 * The signed-in shell.
 *
 * Every page beneath this layout requires a session. The check here is a
 * convenience so pages render a login redirect rather than an error — the
 * API is still the thing that actually enforces access, and it does so per
 * request regardless of what this layout decided.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect('/login');

  return (
    <div className="flex min-h-svh">
      <aside className="bg-card hidden w-60 shrink-0 border-r md:flex md:flex-col">
        <div className="flex h-14 items-center px-5">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Sambehen
          </Link>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto">
          <AppSidebar role={actor.role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {/* Below md the sidebar is hidden, so this drawer is the only
                way off the current page. */}
            <MobileNav role={actor.role} />
            <Link href="/dashboard" className="font-semibold tracking-tight md:hidden">
              Sambehen
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu username={actor.username} role={actor.role} />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
