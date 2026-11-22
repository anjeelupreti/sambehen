'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownIcon, CheckCheckIcon, CheckIcon, Clock3Icon, Loader2Icon } from 'lucide-react';

import { MessageAttachments } from './attachments';
import { dayLabel, messageTime, sameDay } from './format';
import type { ChatMessage } from './types';
import { cn } from '@/lib/utils';

/** Messages this close together, from the same side, read as one group. */
const GROUP_GAP_MS = 5 * 60_000;
/** Within this distance of the bottom, new messages keep the view pinned. */
const PIN_THRESHOLD_PX = 120;

/**
 * A conversation: day separators, grouped bubbles, time and read ticks in
 * each bubble's corner, history loading as you scroll up, and a typing
 * indicator. Shared by every chat surface.
 */
export function ChatThread({
  messages,
  readAt,
  typing,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onRetry,
  loading,
  empty,
}: {
  messages: ChatMessage[];
  readAt: string | null;
  typing: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (message: ChatMessage) => void;
  loading?: boolean;
  empty?: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const [unseen, setUnseen] = useState(0);
  const previous = useRef<{ first?: string; last?: string; count: number; height: number }>({
    count: 0,
    height: 0,
  });

  const nearBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
  };
  const toBottom = (smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setUnseen(0);
  };

  // Keep the reader's place through every kind of change: first load jumps
  // to the bottom, history loaded above keeps the same message on screen,
  // and a new arrival follows the reader only if they were at the bottom.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const first = messages[0]?.id;
    const last = messages[messages.length - 1]?.id;
    const prev = previous.current;

    if (prev.count === 0 && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
    } else if (first !== prev.first && last === prev.last) {
      el.scrollTop += el.scrollHeight - prev.height;
    } else if (last !== prev.last && messages.length > prev.count) {
      const newest = messages[messages.length - 1];
      const wasPinned = prev.height - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
      if (newest?.mine || wasPinned) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      else setUnseen((count) => count + 1);
    }

    previous.current = { first, last, count: messages.length, height: el.scrollHeight };
  }, [messages]);

  useEffect(() => {
    if (typing && nearBottom()) toBottom(true);
  }, [typing]);

  // Load history when the top of the thread comes into view.
  useEffect(() => {
    const sentinel = topSentinel.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !loadingOlder) onLoadOlder();
      },
      { root: scroller.current, rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, onLoadOlder]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={() => nearBottom() && unseen > 0 && setUnseen(0)}
        className="chat-wallpaper h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div ref={topSentinel} />
        {loadingOlder && (
          <div
            className="text-muted-foreground flex justify-center py-2"
            aria-label="Loading earlier messages"
          >
            <Loader2Icon className="size-4 animate-spin" />
          </div>
        )}

        {loading ? (
          <ThreadSkeleton />
        ) : messages.length === 0 ? (
          <div className="text-muted-foreground grid h-full place-items-center text-sm">
            {empty}
          </div>
        ) : (
          <ol className="mx-auto flex max-w-3xl flex-col">
            {messages.map((message, index) => {
              const before = messages[index - 1];
              const after = messages[index + 1];
              const newDay = !before || !sameDay(before.createdAt, message.createdAt);
              const joinsPrevious = !newDay && continues(before, message);
              const joinsNext =
                Boolean(after) &&
                sameDay(message.createdAt, after!.createdAt) &&
                continues(message, after!);
              return (
                <Fragment key={message.id}>
                  {newDay && <DaySeparator iso={message.createdAt} />}
                  <Bubble
                    message={message}
                    read={Boolean(readAt) && message.createdAt <= readAt!}
                    first={!joinsPrevious}
                    last={!joinsNext}
                    onRetry={onRetry}
                  />
                </Fragment>
              );
            })}
          </ol>
        )}

        {typing && <TypingBubble />}
      </div>

      {unseen > 0 && (
        <button
          type="button"
          onClick={() => toBottom(true)}
          className="bg-card text-foreground absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md"
        >
          <ArrowDownIcon className="size-3.5" />
          {unseen === 1 ? '1 new message' : `${unseen} new messages`}
        </button>
      )}
    </div>
  );
}

function continues(a: ChatMessage, b: ChatMessage): boolean {
  return (
    a.mine === b.mine &&
    (a.senderLabel ?? '') === (b.senderLabel ?? '') &&
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() < GROUP_GAP_MS
  );
}

function DaySeparator({ iso }: { iso: string }) {
  return (
    <li className="sticky top-0 z-10 flex justify-center py-3">
      <span className="bg-card/95 text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium shadow-xs backdrop-blur">
        {dayLabel(iso)}
      </span>
    </li>
  );
}

function Bubble({
  message,
  read,
  first,
  last,
  onRetry,
}: {
  message: ChatMessage;
  read: boolean;
  first: boolean;
  last: boolean;
  onRetry: (message: ChatMessage) => void;
}) {
  const { mine } = message;
  const hasBody = message.body.trim().length > 0;
  const hasAttachments = message.attachments.length > 0;
  const onlyMedia =
    !hasBody && hasAttachments && message.attachments.every((a) => a.mimeType.startsWith('image/'));

  return (
    <li
      className={cn('flex flex-col', mine ? 'items-end' : 'items-start', first ? 'mt-3' : 'mt-0.5')}
    >
      {first && message.senderLabel && (
        <span className="text-muted-foreground mb-1 px-1 text-xs font-medium">
          {message.senderLabel}
        </span>
      )}
      <div
        className={cn(
          'relative max-w-[82%] rounded-2xl sm:max-w-[68%]',
          onlyMedia ? 'p-1' : 'px-3 py-2',
          mine ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border',
          // The tail: the corner nearest the sender squares off on the
          // last bubble of a group.
          mine && last && 'rounded-br-md',
          !mine && last && 'rounded-bl-md',
          message.status === 'sending' && 'opacity-80',
        )}
      >
        {hasAttachments && (
          <div className={cn(hasBody && 'mb-1.5')}>
            <MessageAttachments attachments={message.attachments} mine={mine} />
          </div>
        )}
        {hasBody && (
          <p className="text-[15px] leading-snug break-words whitespace-pre-wrap">
            {message.body}
            {/* Reserves room so the timestamp never sits on top of text. */}
            <span className="inline-block w-16" aria-hidden />
          </p>
        )}
        <span
          className={cn(
            'flex items-center justify-end gap-1 text-[11px] leading-none tabular-nums',
            hasBody ? '-mt-3' : 'mt-1 px-1.5 pb-0.5',
            mine ? 'text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
          {mine && <Status status={message.status} read={read} />}
        </span>
      </div>
      {mine && message.status === 'failed' && (
        <button
          type="button"
          onClick={() => onRetry(message)}
          className="text-destructive mt-1 text-xs font-medium hover:underline"
        >
          Not sent. Tap to retry.
        </button>
      )}
    </li>
  );
}

function Status({ status, read }: { status: ChatMessage['status']; read: boolean }) {
  if (status === 'sending') return <Clock3Icon className="size-3" aria-label="Sending" />;
  if (status === 'failed') return null;
  if (read) return <CheckCheckIcon className="size-3.5" aria-label="Read" />;
  return <CheckIcon className="size-3.5" aria-label="Sent" />;
}

function TypingBubble() {
  return (
    <div className="mx-auto mt-3 flex max-w-3xl" aria-label="Typing">
      <span className="bg-card flex items-center gap-1 rounded-2xl rounded-bl-md border px-3.5 py-3">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="bg-muted-foreground/70 size-1.5 rounded-full motion-safe:animate-bounce"
            style={{ animationDelay: `${dot * 140}ms`, animationDuration: '1s' }}
          />
        ))}
      </span>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 py-4" aria-label="Loading messages">
      {[60, 40, 72, 52, 36].map((width, index) => (
        <div
          key={index}
          className={cn(
            'bg-muted h-10 animate-pulse rounded-2xl',
            index % 2 ? 'self-end' : 'self-start',
          )}
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}
