'use client';

import { useState, type ReactNode } from 'react';
import { ArrowLeftIcon, UploadIcon } from 'lucide-react';

import { ChatAvatar } from './avatar';
import { ChatComposer } from './composer';
import { lastSeenLabel } from './format';
import { ChatThread } from './thread';
import type { Presence } from './socket';
import type { useChatThread } from './use-chat-thread';
import { useAttachmentUpload } from '@/hooks/use-attachment-upload';
import { cn } from '@/lib/utils';

/**
 * One open conversation: header, thread and composer, with the whole pane
 * accepting dropped files.
 */
export function ChatPane({
  title,
  avatarUrl,
  subtitle,
  presence,
  typing,
  thread,
  uploadUrl,
  onTyping,
  onBack,
  actions,
  placeholder,
  compact,
}: {
  title: string;
  avatarUrl?: string | null;
  /** Shown under the name when there is no presence to report. */
  subtitle?: string | null;
  presence?: Presence;
  typing: boolean;
  thread: ReturnType<typeof useChatThread>;
  uploadUrl: string;
  onTyping?: (isTyping: boolean) => void;
  onBack?: () => void;
  actions?: ReactNode;
  placeholder?: string;
  compact?: boolean;
}) {
  const upload = useAttachmentUpload(uploadUrl);
  const [dragging, setDragging] = useState(false);

  const status = typing
    ? 'typing…'
    : presence?.online
      ? 'Online'
      : (lastSeenLabel(presence?.lastSeenAt ?? null) ?? subtitle ?? null);

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes('Files')) setDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length) upload.addFiles(event.dataTransfer.files);
      }}
    >
      <header
        className={cn(
          'bg-background flex items-center gap-3 border-b',
          compact ? 'px-3 py-2' : 'px-4 py-3',
        )}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className={cn(
              'hover:bg-accent focus-visible:ring-ring/70 -ml-1 grid size-9 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px]',
              // The full inbox shows the list beside the thread from md up.
              !compact && 'md:hidden',
            )}
          >
            <ArrowLeftIcon className="size-5" />
          </button>
        )}
        <ChatAvatar
          name={title}
          src={avatarUrl}
          online={presence?.online}
          size={compact ? 'sm' : 'md'}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          {status && (
            <p
              className={cn(
                'truncate text-xs',
                typing || presence?.online ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {status}
            </p>
          )}
        </div>
        {actions}
      </header>

      <ChatThread
        messages={thread.messages}
        readAt={thread.readAt}
        typing={typing}
        hasMore={thread.hasMore}
        loadingOlder={thread.loadingOlder}
        onLoadOlder={thread.loadOlder}
        onRetry={thread.retry}
        loading={thread.loading}
        empty="No messages yet. Say hello."
      />

      <ChatComposer
        upload={upload}
        onSend={thread.send}
        onTyping={onTyping}
        placeholder={placeholder}
      />

      {dragging && (
        <div className="border-primary bg-primary/10 text-primary pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed">
          <span className="flex items-center gap-2 font-semibold">
            <UploadIcon className="size-5" />
            Drop files to attach
          </span>
        </div>
      )}
    </section>
  );
}
