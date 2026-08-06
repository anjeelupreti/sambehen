'use client';

import { useState } from 'react';
import { BanIcon, ListChecksIcon, MoreHorizontalIcon } from 'lucide-react';

import { cancelCampaign, loadCampaignRecipients } from '@/app/(app)/broadcast/actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ExportButton } from '@/components/export-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAction } from '@/hooks/use-action';
import { formatDateTime } from '@/lib/money';
import type { components } from '@/lib/api-schema';

type Recipient = components['schemas']['CampaignRecipientDto'];

/**
 * Per-campaign actions.
 *
 * Cancelling is only offered while a campaign is queued or sending — once
 * it has gone out there is nothing to cancel, and offering the option would
 * imply mail can be recalled.
 */
export function CampaignActions({
  campaignId,
  subject,
  status,
}: {
  campaignId: string;
  subject: string;
  status: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const cancel = useAction(cancelCampaign);

  const cancellable = status === 'queued' || status === 'sending';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Actions for ${subject}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onSelect={async () => setRecipients(await loadCampaignRecipients(campaignId))}
          >
            <ListChecksIcon className="size-4" />
            View recipients
          </DropdownMenuItem>

          {cancellable ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
              <BanIcon className="size-4" />
              Cancel sending
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Cancel "${subject}"?`}
        description="Anything already delivered stays delivered — this only stops what has not been sent yet."
        confirmLabel="Cancel sending"
        destructive
        onConfirm={() => cancel.run(campaignId)}
      />

      <Dialog open={recipients !== null} onOpenChange={() => setRecipients(null)}>
        <DialogContent className="max-h-[80svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <DialogTitle>Recipients</DialogTitle>
              <DialogDescription>
                Per-address outcome for “{subject}”. A failure here is one address, not the whole
                campaign.
              </DialogDescription>
            </div>
            <ExportButton exportKey="email-recipients" params={{ campaignId }} />
          </DialogHeader>

          {recipients && recipients.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {recipients.map((recipient) => (
                <li
                  key={recipient.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{recipient.email}</p>
                    {recipient.error ? (
                      <p className="text-destructive truncate text-xs">{recipient.error}</p>
                    ) : recipient.sentAt ? (
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(recipient.sentAt)}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      recipient.status === 'sent'
                        ? 'default'
                        : recipient.status === 'failed'
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {recipient.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No recipients recorded for this campaign.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
