'use client';

import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Confirmation for an action that is awkward or impossible to undo.
 *
 * The dialog stays open while the action runs and closes only on success,
 * so a failure leaves the user where they were with the toast explaining
 * why, rather than dismissing and appearing to have worked.
 *
 * `confirmLabel` should name the action ("Suspend customer"), never "OK" —
 * the button text is the last thing read before committing.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<{ ok: boolean }>;
}) {
  const [running, setRunning] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={running ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={running}
            className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
            onClick={async (event) => {
              event.preventDefault();
              setRunning(true);
              const result = await onConfirm();
              setRunning(false);
              if (result.ok) onOpenChange(false);
            }}
          >
            {running ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
