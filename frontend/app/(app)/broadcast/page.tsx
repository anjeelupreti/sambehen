import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CampaignActions } from '@/components/broadcast/campaign-actions';
import { ComposeBroadcastModal } from '@/components/broadcast/compose-broadcast-modal';
import { PaginationControls } from '@/components/pagination-controls';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiList } from '@/lib/api';
import { formatCount, formatDateTime } from '@/lib/money';
import { getActor } from '@/lib/session';
import type { components } from '@/lib/api-schema';

type Campaign = components['schemas']['CampaignResponseDto'];

export const metadata: Metadata = { title: 'Broadcast' };

/**
 * Status colours.
 *
 * `partial` is deliberately marked as a problem rather than a success: some
 * recipients did not receive it, and that is the state most worth noticing
 * on this page.
 */
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  queued: 'outline',
  sending: 'outline',
  sent: 'default',
  partial: 'destructive',
  failed: 'destructive',
  cancelled: 'secondary',
};

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();

  // Master and manager only, matching the API. A runner sent here gets the
  // same "not found" every other denial gives.
  if (!actor || actor.role === 'runner') notFound();

  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const { data, meta } = await apiList<Campaign>('/team/email/campaigns', {
    query: { page: first('page') ?? 1, limit: 20 },
  });

  const totals = data.reduce(
    (acc, campaign) => ({
      sent: acc.sent + (campaign.sentCount ?? 0),
      failed: acc.failed + (campaign.failedCount ?? 0),
      inFlight:
        acc.inFlight + (campaign.status === 'queued' || campaign.status === 'sending' ? 1 : 0),
    }),
    { sent: 0, failed: 0, inFlight: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Broadcast</h1>
          <p className="text-muted-foreground text-sm">
            Email to many customers at once. Messaging is one thread per customer, so this is the
            only way to reach a group — and customers read it in their inbox, not in the portal.
          </p>
        </div>
        <ComposeBroadcastModal />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaigns" value={formatCount(meta.total)} />
        <StatCard
          label="Delivered"
          value={formatCount(totals.sent)}
          hint="Across the campaigns on this page."
        />
        <StatCard
          label="Failed"
          value={formatCount(totals.failed)}
          hint="Bounced, refused, or no address."
        />
        <StatCard
          label="In flight"
          value={formatCount(totals.inFlight)}
          hint="Queued or currently sending."
        />
      </section>

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                    No broadcasts yet. Compose one to reach a group of customers.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="max-w-xs truncate font-medium">
                      {campaign.subject}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm capitalize">
                      {campaign.emailKind}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[campaign.status] ?? 'outline'}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatCount(campaign.recipientCount)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {formatCount(campaign.sentCount)}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {campaign.failedCount > 0 ? (
                        <span className="text-destructive">
                          {formatCount(campaign.failedCount)}
                        </span>
                      ) : (
                        formatCount(campaign.failedCount)
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDateTime(campaign.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <CampaignActions
                        campaignId={campaign.id}
                        subject={campaign.subject}
                        status={campaign.status}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <PaginationControls meta={meta} />
        </CardContent>
      </Card>
    </div>
  );
}
