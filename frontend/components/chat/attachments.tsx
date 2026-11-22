'use client';

import { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, XIcon } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { MessageAttachment } from '@/lib/types';
import { cn } from '@/lib/utils';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "PDF", "XLSX", "DOCX" — from the file name, falling back to the type. */
export function fileExtension(file: { filename: string; mimeType: string }): string {
  const fromName = file.filename.split('.').pop();
  if (fromName && fromName.length <= 5 && fromName !== file.filename) return fromName.toUpperCase();
  return file.mimeType.split('/').pop()?.toUpperCase().slice(0, 4) ?? 'FILE';
}

/**
 * Attachments inside a bubble: images as a grid that opens full screen,
 * other files as cards that download.
 */
export function MessageAttachments({
  attachments,
  mine,
}: {
  attachments: MessageAttachment[];
  mine: boolean;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const files = attachments.filter((a) => !a.mimeType.startsWith('image/'));
  const shown = images.slice(0, 4);
  const hidden = images.length - shown.length;

  return (
    <div className="space-y-1.5">
      {images.length > 0 && (
        <div
          className={cn(
            'grid gap-1 overflow-hidden rounded-xl',
            shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {shown.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setViewing(index)}
              aria-label={`Open ${image.filename}`}
              className={cn(
                'bg-muted focus-visible:ring-ring/70 relative block overflow-hidden outline-none focus-visible:ring-[3px]',
                shown.length === 1 ? 'max-h-80 w-64 sm:w-72' : 'aspect-square w-32 sm:w-36',
                shown.length === 3 && index === 0 && 'col-span-2 aspect-[2/1] w-auto',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.filename}
                loading="lazy"
                className="size-full object-cover transition-transform duration-200 hover:scale-[1.02]"
              />
              {index === shown.length - 1 && hidden > 0 && (
                <span className="absolute inset-0 grid place-items-center bg-black/50 text-xl font-semibold text-white">
                  +{hidden}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {files.map((file) => (
        <a
          key={file.url}
          href={file.url}
          download={file.filename}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'focus-visible:ring-ring/70 flex w-64 max-w-full items-center gap-3 rounded-xl p-2.5 transition-colors outline-none focus-visible:ring-[3px] sm:w-72',
            mine ? 'bg-black/15 hover:bg-black/20' : 'bg-muted hover:bg-accent',
          )}
        >
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-lg text-[10px] font-bold tracking-wide',
              mine ? 'bg-primary-foreground text-primary' : 'bg-background text-muted-foreground',
            )}
          >
            {fileExtension(file)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{file.filename}</span>
            <span
              className={cn(
                'block text-xs',
                mine ? 'text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {formatBytes(file.size)}
            </span>
          </span>
          <DownloadIcon className="size-4 shrink-0 opacity-80" aria-hidden />
        </a>
      ))}

      <Lightbox images={images} index={viewing} onIndexChange={setViewing} />
    </div>
  );
}

/** Full-screen image viewer with arrow-key navigation and download. */
function Lightbox({
  images,
  index,
  onIndexChange,
}: {
  images: MessageAttachment[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const current = index === null ? null : images[index];

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') onIndexChange(Math.min(index + 1, images.length - 1));
      if (event.key === 'ArrowLeft') onIndexChange(Math.max(index - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onIndexChange]);

  return (
    <Dialog open={current !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[94svh] w-auto max-w-[94vw] gap-0 overflow-hidden border-0 bg-black/95 p-0 sm:max-w-[94vw]"
      >
        <DialogTitle className="sr-only">{current?.filename ?? 'Image'}</DialogTitle>
        {current && (
          <>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
              <p className="min-w-0 truncate text-sm">
                {current.filename}
                <span className="ml-2 text-white/60">{formatBytes(current.size)}</span>
              </p>
              <div className="flex items-center gap-1">
                <a
                  href={current.url}
                  download={current.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-9 place-items-center rounded-lg hover:bg-white/10"
                  aria-label="Download"
                >
                  <DownloadIcon className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => onIndexChange(null)}
                  className="grid size-9 place-items-center rounded-lg hover:bg-white/10"
                  aria-label="Close"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </div>
            <div className="relative grid place-items-center px-12 pb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={current.filename}
                className="max-h-[80svh] max-w-full object-contain"
              />
              {images.length > 1 && index !== null && (
                <>
                  <button
                    type="button"
                    onClick={() => onIndexChange(Math.max(index - 1, 0))}
                    disabled={index === 0}
                    className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                    aria-label="Previous image"
                  >
                    <ChevronLeftIcon className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onIndexChange(Math.min(index + 1, images.length - 1))}
                    disabled={index === images.length - 1}
                    className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                    aria-label="Next image"
                  >
                    <ChevronRightIcon className="size-5" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
