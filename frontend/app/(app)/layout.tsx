import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';

import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getActor } from '@/lib/session';
import { signOut } from './actions';

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
        <AppSidebar role={actor.role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{actor.username}</span>
            <Badge variant="secondary" className="capitalize">
              {actor.role}
            </Badge>
          </div>

          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOutIcon />
              Sign out
            </Button>
          </form>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
