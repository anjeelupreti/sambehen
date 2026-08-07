'use client';

import { FileIcon, Loader2Icon, TriangleAlertIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PendingAttachment } from '@/hooks/use-attachment-upload';

/** Files picked for the message being composed, shown above the input until sent. */
export function AttachmentChips({
  pending,
  onRemove,
}: {
  pending: PendingAttachment[];
  onRemove: (id: string) => void;
}) {
  if (pending.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2">
      {pending.map((item) => (
        <div
          key={item.id}
          className={cn(
            'bg-muted flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2 text-xs',
            item.status === 'error' && 'bg-destructive/10 text-destructive',
          )}
          title={item.status === 'error' ? item.error : item.file.name}
        >
          {item.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.previewUrl} alt="" className="size-5 rounded object-cover" />
          ) : item.status === 'error' ? (
            <TriangleAlertIcon className="size-3.5" />
          ) : (
            <FileIcon className="size-3.5" />
          )}
          <span className="max-w-32 truncate">{item.file.name}</span>
          {item.status === 'uploading' ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-4"
              aria-label={`Remove ${item.file.name}`}
              onClick={() => onRemove(item.id)}
            >
              <XIcon className="size-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
