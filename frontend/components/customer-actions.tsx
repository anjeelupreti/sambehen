'use client';

import { useState } from 'react';
import {
  BanIcon,
  CheckCircleIcon,
  CopyIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  PauseCircleIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { changeCustomerStatus, resetCustomerPassword } from '@/app/(app)/customers/actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAction } from '@/hooks/use-action';
import type { CustomerStatus } from '@/lib/types';

type Pending = { status: CustomerStatus; title: string; body: string; label: string } | null;

/**
 * Per-customer actions.
 *
 * Status changes that cut off access are confirmed first, because
 * suspending or banning revokes every live session immediately — there is
 * no undo that puts the customer back mid-request.
 */
export function CustomerActions({
  customerId,
  username,
  status,
}: {
  customerId: string;
  username: string;
  status: CustomerStatus;
}) {
  const statusAction = useAction(changeCustomerStatus);
  const passwordAction = useAction(resetCustomerPassword);

  const [pending, setPending] = useState<Pending>(null);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);

  const confirmStatus = (next: Pending) => setPending(next);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Actions for ${username}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate">{username}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {status !== 'active' ? (
            <DropdownMenuItem
              onSelect={() =>
                confirmStatus({
                  status: 'active',
                  title: `Reactivate ${username}?`,
                  body: 'The customer will be able to sign in again.',
                  label: 'Reactivate',
                })
              }
            >
              <CheckCircleIcon className="size-4" />
              Reactivate
            </DropdownMenuItem>
          ) : null}

          {status !== 'suspended' ? (
            <DropdownMenuItem
              onSelect={() =>
                confirmStatus({
                  status: 'suspended',
                  title: `Suspend ${username}?`,
                  body: 'Every active session is revoked immediately and the customer is signed out.',
                  label: 'Suspend',
                })
              }
            >
              <PauseCircleIcon className="size-4" />
              Suspend
            </DropdownMenuItem>
          ) : null}

          {status !== 'banned' ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                confirmStatus({
                  status: 'banned',
                  title: `Ban ${username}?`,
                  body: 'Every active session is revoked immediately. Their records and history are kept.',
                  label: 'Ban customer',
                })
              }
            >
              <BanIcon className="size-4" />
              Ban
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={passwordAction.pending}
            onSelect={async () => {
              const result = await passwordAction.run(customerId);
              if (result.ok && result.data) setIssuedPassword(result.data.password);
            }}
          >
            <KeyRoundIcon className="size-4" />
            Reset password
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.title ?? ''}
        description={pending?.body ?? ''}
        confirmLabel={pending?.label ?? ''}
        destructive={pending?.status === 'banned' || pending?.status === 'suspended'}
        onConfirm={async () => {
          if (!pending) return { ok: false };
          return statusAction.run(customerId, pending.status);
        }}
      />

      {/* The API generates this password once and cannot show it again, so
          it gets a dialog the user has to dismiss rather than a toast that
          disappears on its own. */}
      <Dialog open={issuedPassword !== null} onOpenChange={() => setIssuedPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New password for {username}</DialogTitle>
            <DialogDescription>
              This is shown once. Copy it now — it cannot be retrieved later.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <code className="bg-muted tabular flex-1 rounded-md px-3 py-2 text-sm break-all">
              {issuedPassword}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy password"
              onClick={async () => {
                if (!issuedPassword) return;
                try {
                  await navigator.clipboard.writeText(issuedPassword);
                  toast.success('Password copied.');
                } catch {
                  // Clipboard access is refused outside a secure context;
                  // the password is on screen either way.
                  toast.error('Could not copy. Select the text and copy it manually.');
                }
              }}
            >
              <CopyIcon className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
