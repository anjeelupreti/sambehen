import { FileIcon } from 'lucide-react';

import type { MessageAttachment } from '@/lib/types';
import { cn } from '@/lib/utils';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * What a sent message's attachments look like in the thread.
 *
 * Images render inline — that's the point of sending one, to be seen
 * without a click. Anything else is a named, sized chip that opens in a
 * new tab, since the browser (not this app) decides how to handle a PDF
 * or a spreadsheet.
 */
export function MessageAttachments({
  attachments,
  fromSelf,
}: {
  attachments: MessageAttachment[];
  fromSelf: boolean;
}) {
  const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const files = attachments.filter((a) => !a.mimeType.startsWith('image/'));

  return (
    <div className="space-y-1.5">
      {images.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {images.map((image, index) => (
            <a
              key={index}
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.filename}
                className="h-32 max-w-48 object-cover transition-opacity hover:opacity-90"
              />
            </a>
          ))}
        </div>
      ) : null}

      {files.map((file, index) => (
        <a
          key={index}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex max-w-64 items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors',
            fromSelf
              ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20'
              : 'bg-background hover:bg-accent',
          )}
        >
          <FileIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.filename}</span>
          <span className={cn('shrink-0', fromSelf ? 'opacity-70' : 'text-muted-foreground')}>
            {formatBytes(file.size)}
          </span>
        </a>
      ))}
    </div>
  );
}
