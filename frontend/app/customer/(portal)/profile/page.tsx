import type { Metadata } from 'next';
import { ChatAvatar } from '@/components/chat/avatar';
import { MailIcon, UserIcon } from 'lucide-react';

import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { customerGet } from '@/lib/customer-api';
import { formatDateTime } from '@/lib/money';
import type { components } from '@/lib/api-schema';
import { CUSTOMER_STATUS_VARIANT } from '@/lib/status';

type CustomerProfile = components['schemas']['CustomerProfileDto'];

export const metadata: Metadata = { title: 'Your profile' };

/**
 * Read-only, deliberately. The API refuses every write to a customer's own
 * record — even a password change is something staff do on their behalf —
 * so this page has no form on it anywhere, matching what the layout already
 * tells people in the footer.
 */
export default async function CustomerProfilePage() {
  const profile = await customerGet<CustomerProfile>('/me/profile');

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <ChatAvatar name={profile.fullName || profile.username} src={profile.avatarUrl} size="xl" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{profile.fullName || 'Your profile'}</h1>
          <p className="text-muted-foreground text-sm">{profile.username}</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="size-4" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" value={profile.username} />
            <Field
              label="Full name"
              value={profile.fullName ?? <span className="text-muted-foreground">Not on file</span>}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              value={
                <span className="flex items-center gap-1.5">
                  <MailIcon className="text-muted-foreground size-3.5" />
                  {profile.email}
                </span>
              }
            />
            <Field
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

          <Field
            label="Last signed in"
            value={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : 'This session'}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular">
              <Money value={profile.balance} />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bonus balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular">
              <Money value={profile.bonusBalance} />
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Referral bonuses, kept separate from your balance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
