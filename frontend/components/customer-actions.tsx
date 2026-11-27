'use client';

import { useState } from 'react';
import {
  BanIcon,
  CheckCircleIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  PauseCircleIcon,
  StoreIcon,
} from 'lucide-react';

import { changeCustomerStatus, resetCustomerPassword } from '@/app/(app)/customers/actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { OneTimeSecretDialog } from '@/components/one-time-secret-dialog';
import { EditCustomerModal } from '@/components/forms/edit-customer-modal';
import { AssignOwnerDialog } from '@/components/customers/assign-owner-dialog';
import type { AssignableOwner } from '@/components/forms/new-customer-modal';
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
import type { Customer, CustomerStatus } from '@/lib/types';
import { EditIcon, EyeIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Pending = { status: CustomerStatus; title: string; body: string; label: string } | null;

/**
 * Per-customer actions.
 *
 * Status changes that cut off access are confirmed first, because
 * suspending or banning revokes every live session immediately — there is
 * no undo that puts the customer back mid-request.
 */
export function CustomerActions({
  customer,
  hideView,
  compact,
  owners,
}: {
  customer: Customer;
  /** Who the player can be moved to. Left out for stores, who can't move players. */
  owners?: AssignableOwner[];
  hideView?: boolean;
  /**
   * For table rows: the row itself opens the customer, so only the menu is
   * shown and editing moves into it, instead of three icons on every row.
   */
  compact?: boolean;
}) {
  const { id: customerId, username, status } = customer;
  const statusAction = useAction(changeCustomerStatus);
  const passwordAction = useAction(resetCustomerPassword);

  const [pending, setPending] = useState<Pending>(null);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const canAssign = Boolean(owners?.length) && status !== 'pending';
  const router = useRouter();

  const confirmStatus = (next: Pending) => setPending(next);

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {!hideView && !compact && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => router.push(`/customers/${customerId}`)}
            aria-label={`View ${username}`}
          >
            <EyeIcon className="size-4" />
          </Button>
        )}
        {!compact && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setIsEditing(true)}
            aria-label={`Edit ${username}`}
          >
            <EditIcon className="size-4" />
          </Button>
        )}

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
            {compact && (
              <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                <EditIcon className="size-4" />
                Edit details
              </DropdownMenuItem>
            )}

            {canAssign && (
              <DropdownMenuItem onSelect={() => setIsAssigning(true)}>
                <StoreIcon className="size-4" />
                Assign to store…
              </DropdownMenuItem>
            )}

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
      </div>

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

      <EditCustomerModal customer={customer} open={isEditing} onOpenChange={setIsEditing} />

      {canAssign && owners && (
        <AssignOwnerDialog
          customerId={customerId}
          username={username}
          currentOwnerId={customer.storeId ?? customer.managerId ?? null}
          owners={owners}
          open={isAssigning}
          onOpenChange={setIsAssigning}
        />
      )}
    </>
  );
}
