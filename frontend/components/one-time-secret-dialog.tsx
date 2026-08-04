'use client';

import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Shows a value the API will never return again.
 *
 * A dialog rather than a toast, deliberately: a generated password is
 * unrecoverable, and a toast that dismisses itself after a few seconds can
 * take the only copy with it. This stays until it is closed.
 */
export function OneTimeSecretDialog({
  secret,
  title,
  onClose,
}: {
  secret: string | null;
  title: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={secret !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This is shown once. Copy it now — it cannot be retrieved later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <code className="bg-muted tabular flex-1 rounded-md px-3 py-2 text-sm break-all">
            {secret}
          </code>
          <Button
            variant="outline"
            size="icon"
            aria-label="Copy to clipboard"
            onClick={async () => {
              if (!secret) return;
              try {
                await navigator.clipboard.writeText(secret);
                toast.success('Copied.');
              } catch {
                // Clipboard access is refused outside a secure context; the
                // value is on screen either way.
                toast.error('Could not copy. Select the text and copy it manually.');
              }
            }}
          >
            <CopyIcon className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
