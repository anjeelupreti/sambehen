'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PaperclipIcon, SendHorizontalIcon, TriangleAlertIcon, XIcon } from 'lucide-react';

import { fileExtension, formatBytes } from './attachments';
import type { AttachmentUpload, PendingAttachment } from '@/hooks/use-attachment-upload';
import type { MessageAttachment } from '@/lib/types';
import { cn } from '@/lib/utils';

const ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';
/** Typing stops being announced after this long without a keystroke. */
const TYPING_IDLE_MS = 3000;

/**
 * Writing a message: a box that grows with the text (Enter sends,
 * Shift+Enter starts a new line), files from the paperclip or pasted in,
 * and a tray showing each upload's progress. Dropped files arrive through
 * the shared `upload` the pane also feeds.
 */
export function ChatComposer({
  upload,
  onSend,
  onTyping,
  placeholder = 'Message',
  autoFocus,
}: {
  upload: AttachmentUpload;
  onSend: (body: string, attachments: MessageAttachment[]) => void;
  onTyping?: (isTyping: boolean) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const typing = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSend = (draft.trim().length > 0 || upload.ready.length > 0) && !upload.uploading;

  const stopTyping = () => {
    if (idle.current) clearTimeout(idle.current);
    if (typing.current) {
      typing.current = false;
      onTyping?.(false);
    }
  };

  const noteTyping = (value: string) => {
    if (!onTyping) return;
    if (!value.trim()) return stopTyping();
    if (!typing.current) {
      typing.current = true;
      onTyping(true);
    }
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  useEffect(() => () => stopTyping(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Grow with the text, up to about six lines, then scroll inside.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim(), upload.ready);
    setDraft('');
    upload.clear();
    stopTyping();
    box.current?.focus();
  };

  return (
    <div className="bg-background border-t">
      {upload.pending.length > 0 && <UploadTray items={upload.pending} onRemove={upload.remove} />}

      <form
        className="flex items-end gap-2 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) upload.addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Attach files"
          className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/70 grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
        >
          <PaperclipIcon className="size-5" />
        </button>

        <div className="bg-muted/60 focus-within:ring-ring/70 flex min-h-11 flex-1 items-center rounded-3xl border px-4 py-2 focus-within:ring-[3px]">
          <textarea
            ref={box}
            value={draft}
            rows={1}
            autoFocus={autoFocus}
            aria-label="Message"
            placeholder={placeholder}
            onChange={(event) => {
              setDraft(event.target.value);
              noteTyping(event.target.value);
            }}
            onBlur={stopTyping}
            onKeyDown={(event) => {
              // isComposing: Enter confirms a character in IME input
              // (Chinese, Japanese, Korean) and must not send.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files);
              if (files.length) {
                event.preventDefault();
                upload.addFiles(files);
              }
            }}
            className="placeholder:text-muted-foreground max-h-40 w-full resize-none bg-transparent text-[15px] leading-6 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="bg-primary text-primary-foreground focus-visible:ring-ring/70 grid size-11 shrink-0 place-items-center rounded-full transition-opacity outline-none focus-visible:ring-[3px] disabled:opacity-40"
        >
          <SendHorizontalIcon className="size-5" />
        </button>
      </form>
    </div>
  );
}

function UploadTray({
  items,
  onRemove,
}: {
  items: PendingAttachment[];
  onRemove: (id: string) => void;
}) {
  return (
    <ul className="flex gap-2 overflow-x-auto px-3 pt-3" aria-label="Attachments to send">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            'bg-muted relative flex h-16 shrink-0 items-center overflow-hidden rounded-xl border',
            item.previewUrl ? 'w-16' : 'w-52 gap-2.5 px-2.5',
            item.status === 'error' && 'border-destructive/50',
          )}
          title={item.status === 'error' ? item.error : item.file.name}
        >
          {item.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <>
              <span className="bg-background text-muted-foreground grid size-10 shrink-0 place-items-center rounded-lg text-[10px] font-bold">
                {item.status === 'error' ? (
                  <TriangleAlertIcon className="text-destructive size-4" />
                ) : (
                  fileExtension({ filename: item.file.name, mimeType: item.file.type })
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{item.file.name}</span>
                <span
                  className={cn(
                    'block text-[11px]',
                    item.status === 'error' ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {item.status === 'error' ? 'Upload failed' : formatBytes(item.file.size)}
                </span>
              </span>
            </>
          )}

          {item.status === 'uploading' && (
            <span
              className="absolute inset-x-0 bottom-0 h-1 bg-black/10"
              aria-label={`Uploading ${Math.round(item.progress * 100)}%`}
            >
              <span
                className="bg-primary block h-full transition-[width]"
                style={{ width: `${Math.max(item.progress, 0.05) * 100}%` }}
              />
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.file.name}`}
            className="bg-background/90 absolute top-1 right-1 grid size-6 place-items-center rounded-full shadow-xs"
          >
            <XIcon className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
