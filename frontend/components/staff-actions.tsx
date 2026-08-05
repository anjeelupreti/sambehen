'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  EditIcon,
  EyeIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  UserCheckIcon,
  UserXIcon,
} from 'lucide-react';

import { resetStaffPassword, setStaffActive } from '@/app/(app)/staff/actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { OneTimeSecretDialog } from '@/components/one-time-secret-dialog';
import { EditStaffModal } from '@/components/forms/edit-staff-modal';
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
import type { Staff } from '@/lib/types';

/**
 * Per-staff actions.
 *
 * Deactivation is confirmed because it ends the member's access at once and
 * their customers stay where they are — the chain is not reassigned as a
 * side effect, which is easy to assume otherwise.
 */
export function StaffActions({ staff, hideView }: { staff: Staff; hideView?: boolean }) {
  const { id: staffId, username, isActive } = staff;
  const activeAction = useAction(setStaffActive);
  const passwordAction = useAction(resetStaffPassword);

  const [confirming, setConfirming] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {!hideView && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`View ${username}`}
          >
            <Link href={`/staff/${staff.id}`}>
              <EyeIcon className="size-4" />
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setIsEditing(true)}
          aria-label={`Edit ${username}`}
        >
          <EditIcon className="size-4" />
        </Button>

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

            {isActive ? (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                <UserXIcon className="size-4" />
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={activeAction.pending}
                onSelect={() => void activeAction.run(staffId, true)}
              >
                <UserCheckIcon className="size-4" />
                Reactivate
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled={passwordAction.pending}
              onSelect={async () => {
                const result = await passwordAction.run(staffId);
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
        open={confirming}
        onOpenChange={setConfirming}
        title={`Deactivate ${username}?`}
        description="They lose access immediately. Their customers stay assigned to them and are not reassigned."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => activeAction.run(staffId, false)}
      />

      <OneTimeSecretDialog
        secret={issuedPassword}
        title={`New password for ${username}`}
        onClose={() => setIssuedPassword(null)}
      />

      <EditStaffModal staff={staff} open={isEditing} onOpenChange={setIsEditing} />
    </>
  );
}
