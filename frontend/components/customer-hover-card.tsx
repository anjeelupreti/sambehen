'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CrownIcon } from 'lucide-react';

import { getCustomerHoverProfile, type CustomerHoverProfile } from '@/app/(app)/customers/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Money } from '@/components/money';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/money';
import type { CustomerStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<
  CustomerStatus,
  'default' | 'secondary' | 'outline' | 'destructive' | 'warning'
> = {
  pending: 'warning',
  active: 'default',
  inactive: 'secondary',
  suspended: 'outline',
  banned: 'destructive',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

/**
 * Wraps a customer's name with a hover preview of their profile.
 *
 * The profile is fetched lazily on first open rather than passed in,
 * because most places this wraps (referrals, transactions, spin winners)
 * only have a username and id on hand — widening every one of those list
 * queries to carry VIP status and balance just for an occasional hover
 * would cost every page load to save one request on the pages where
 * someone actually lingers over a name.
 *
 * The crown lives here, on the avatar, rather than inline next to every
 * occurrence of a VIP's name in a table: "is this customer currently VIP"
 * needs a join against qualifications that only matters at the moment
 * someone is actually checking who this is, not on every row of every
 * list rendering ambiently.
 */
export function CustomerHoverCard({
  customerId,
  username,
  fullName,
  children,
}: {
  customerId: string;
  username: string;
  fullName?: string | null;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<CustomerHoverProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    if (loaded || loading) return;
    setLoading(true);
    getCustomerHoverProfile(customerId)
      .then((result) => {
        setProfile(result);
        setLoaded(true);
      })
      .finally(() => setLoading(false));
  };

  return (
    <HoverCard onOpenChange={(open) => open && load()}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar className="size-10">
              <AvatarFallback>{initials(fullName || username)}</AvatarFallback>
            </Avatar>
            {profile?.isVip ? (
              <span
                className="bg-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border shadow-sm"
                title={`VIP tier ${profile.vipTier}`}
              >
                <CrownIcon className="size-3 fill-amber-400 text-amber-500" />
              </span>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/customers/${customerId}`}
                className="truncate text-sm font-semibold hover:underline"
              >
                {username}
              </Link>
              {profile?.isVip ? (
                <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                  <CrownIcon className="size-2.5 fill-amber-400 text-amber-500" />
                  Tier {profile.vipTier}
                </Badge>
              ) : null}
            </div>
            {fullName ? <p className="text-muted-foreground truncate text-xs">{fullName}</p> : null}
          </div>
        </div>

        <div className={cn('mt-3 space-y-2 border-t pt-3', loading && 'opacity-60')}>
          {loading && !loaded ? (
            <>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </>
          ) : profile ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={STATUS_VARIANT[profile.customer.status]}
                  className="h-5 px-1.5 text-[10px] capitalize"
                >
                  {profile.customer.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Balance</span>
                <Money value={profile.customer.balance} className="text-xs" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Bonus balance</span>
                <Money value={profile.customer.bonusBalance} className="text-xs" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Owner</span>
                <span className="truncate font-medium">
                  {profile.customer.storeUsername ?? profile.customer.managerUsername ?? '—'}
                </span>
              </div>
              {profile.customer.lastActivityAt ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Last activity</span>
                  <span>{formatDate(profile.customer.lastActivityAt)}</span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground text-xs">Couldn&apos;t load this customer.</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
