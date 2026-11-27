'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRightIcon,
  MegaphoneIcon,
  GiftIcon,
  CrownIcon,
  GamepadIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  ScrollTextIcon,
  SparklesIcon,
  TrophyIcon,
  UserCogIcon,
  UsersIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { StaffRole } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Omit to show for every role. */
  roles?: StaffRole[];
}

/**
 * Navigation, filtered by role.
 *
 * Hiding a link is presentation, not access control — the API refuses the
 * request regardless of what the sidebar shows. This exists so a store is
 * not offered pages that would only ever return 403.
 *
 * Only routes that exist appear here. Email campaigns and exports are still
 * unbuilt and so stay unlisted — advertising them would send staff to a
 * 404. Add the entry in the same commit as the page, never before it.
 */
const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
      { href: '/customers', label: 'Customers', icon: UsersIcon },
      { href: '/transactions', label: 'Transactions', icon: ArrowLeftRightIcon },
      // The chat bubble covers quick replies; this is the full inbox with
      // filters and the same live socket, for anyone who wants more room.
      { href: '/messages', label: 'Messages', icon: MessageSquareIcon },
      { href: '/games', label: 'Games', icon: GamepadIcon },
    ],
  },
  {
    label: 'Programs',
    items: [
      { href: '/vips', label: 'VIPs', icon: CrownIcon },
      // Criteria live on the VIPs page and events live on the Spins page —
      // configuration above the list it produces, rather than a separate
      // destination you have to hold in your head alongside it.
      { href: '/spin-winners', label: 'Rewards', icon: SparklesIcon },
      { href: '/wins', label: 'Big wins', icon: TrophyIcon },
      { href: '/referrals', label: 'Referrals', icon: GiftIcon },
      { href: '/broadcast', label: 'Broadcast', icon: MegaphoneIcon, roles: ['master', 'manager'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/staff', label: 'Staff', icon: UserCogIcon, roles: ['master', 'manager'] },
      { href: '/audit-logs', label: 'Audit trail', icon: ScrollTextIcon, roles: ['master'] },
    ],
  },
];

export function AppSidebar({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex flex-col gap-6 p-3" aria-label="Main">
      {sections.map((section) => (
        <div key={section.label} className="flex flex-col gap-0.5">
          <p className="text-muted-foreground px-3 pb-1.5 text-xs font-medium">{section.label}</p>
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring/70 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
