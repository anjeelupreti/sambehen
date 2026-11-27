import type { Metadata } from 'next';

import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';
import { ProfileEditor } from '@/components/customer/profile-editor';
import { NotificationSettings } from '@/components/notifications/notification-settings';
import { customerGet } from '@/lib/customer-api';
import { formatDateTime } from '@/lib/money';
import type { components } from '@/lib/api-schema';
import { CUSTOMER_STATUS_VARIANT } from '@/lib/status';

type CustomerProfile = components['schemas']['CustomerProfileDto'];

export const metadata: Metadata = { title: 'Your profile' };

/**
 * The player's own profile. They can change their photo, name, phone and
 * location; email and username are how they sign in, so staff change
 * those. Balances are shown, never edited here.
 */
export default async function CustomerProfilePage() {
  const profile = await customerGet<CustomerProfile>('/me/profile');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Your profile</h1>

      <ProfileEditor profile={profile} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Figure label="Balance" value={<Money value={profile.balance} />} />
        <Figure label="Bonus balance" value={<Money value={profile.bonusBalance} />} />
        <Figure
          label="Status"
          value={
            <Badge
              variant={CUSTOMER_STATUS_VARIANT[profile.status] ?? 'outline'}
              className="capitalize"
            >
              {profile.status}
            </Badge>
          }
        />
      </div>
      <section id="notifications" className="bg-card scroll-mt-20 rounded-2xl border p-5">
        <h2 className="mb-2 font-semibold">Notifications</h2>
        <NotificationSettings realm="customer" />
      </section>

      <p className="text-muted-foreground text-xs">
        Last signed in {profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : 'this session'}.
      </p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border p-5">
      <p className="text-muted-foreground text-sm">{label}</p>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
