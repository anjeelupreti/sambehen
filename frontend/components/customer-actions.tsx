'use client';

import { useState } from 'react';
import {
  BanIcon,
  CheckCircleIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  PauseCircleIcon,
} from 'lucide-react';

import { changeCustomerStatus, resetCustomerPassword } from '@/app/(app)/customers/actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { OneTimeSecretDialog } from '@/components/one-time-secret-dialog';
import { Button } from '@/components/ui/button';
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

      <OneTimeSecretDialog
        secret={issuedPassword}
        title={`New password for ${username}`}
        onClose={() => setIssuedPassword(null)}
      />
    </>
  );
}
