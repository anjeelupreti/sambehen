'use client';

import { useState, useTransition } from 'react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { deleteWin, setWinHidden } from '@/app/(app)/wins/actions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export function WinShownSwitch({
  id,
  hidden,
  label,
}: {
  id: string;
  hidden: boolean;
  label: string;
}) {
  const [shown, setShown] = useState(!hidden);
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      aria-label={`Show ${label} to players`}
      checked={shown}
      disabled={pending}
      onCheckedChange={(next) => {
        setShown(next);
        startTransition(async () => {
          const result = await setWinHidden(id, !next);
          if (!result.ok) {
            setShown(!next);
            toast.error(result.message);
          }
        });
      }}
    />
  );
}

export function DeleteWinButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${label}`}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this win?"
        description={`${label} will be removed from the wins feed and from this list.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          const result = await deleteWin(id);
          if (!result.ok) toast.error(result.message);
          else toast.success(result.message);
          return result;
        }}
      />
    </>
  );
}
