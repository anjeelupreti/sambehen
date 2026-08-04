'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRightIcon,
  CrownIcon,
  GamepadIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SparklesIcon,
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
 * request regardless of what the sidebar shows. This exists so a runner is
 * not offered pages that would only ever return 403.
 *
 * Only routes that exist appear here. Messaging, email campaigns and
 * exports are still unbuilt and so stay unlisted — advertising them would
 * send staff to a 404. Add the entry in the same commit as the page, never
 * before it.
 */
const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/customers', label: 'Customers', icon: UsersIcon },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRightIcon },
  { href: '/vips', label: 'VIPs', icon: CrownIcon },
  { href: '/spin-winners', label: 'Spin winners', icon: SparklesIcon },
  { href: '/games', label: 'Games', icon: GamepadIcon },
  { href: '/staff', label: 'Staff', icon: UserCogIcon, roles: ['master', 'manager'] },
  { href: '/audit-logs', label: 'Audit trail', icon: ScrollTextIcon, roles: ['master'] },
];

export function AppSidebar({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
