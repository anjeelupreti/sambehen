'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboardIcon, MessageSquareIcon, UserIcon, type LucideIcon } from 'lucide-react';

import { useLiveUnread } from './live-unread';
import { cn } from '@/lib/utils';

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/customer', label: 'Overview', icon: LayoutDashboardIcon },
  { href: '/customer/messages', label: 'Messages', icon: MessageSquareIcon },
  { href: '/customer/profile', label: 'Profile', icon: UserIcon },
];

const isActive = (pathname: string, href: string) =>
  href === '/customer' ? pathname === href : pathname.startsWith(href);

/** Messages shows the unread count until the player is on that page. */
function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-destructive ring-background absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums ring-2">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/** The portal's sections in the header, from tablet width up. */
export function PortalTopNav() {
  const pathname = usePathname();
  const unread = useLiveUnread();
  return (
    <nav aria-label="Portal" className="hidden items-center gap-1 md:flex">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/70 relative inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-[3px]',
              active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="relative">
              <Icon className="size-4" />
              {href === '/customer/messages' && !active && <Badge count={unread} />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The portal's sections as an app-style tab bar along the bottom of the
 * screen on phones, within reach of a thumb. Leaves room for the home
 * indicator on phones that have one.
 */
export function PortalBottomNav() {
  const pathname = usePathname();
  const unread = useLiveUnread();
  return (
    <nav
      aria-label="Portal"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring/70 flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'relative grid h-7 w-14 place-items-center rounded-full transition-colors',
                    active && 'bg-primary/12',
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  {href === '/customer/messages' && !active && <Badge count={unread} />}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
