'use client';

import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { Loader2Icon, SearchIcon } from 'lucide-react';

import { ChatAvatar } from './avatar';
import { listTime } from './format';
import { LabelChips, type ChipLabel } from './label-chips';
import { cn } from '@/lib/utils';

export interface ConversationRow {
  id: string;
  name: string;
  avatarUrl?: string | null;
  preview: string | null;
  time: string | null;
  unread: number;
  online?: boolean;
  typing?: boolean;
  /** The other side wrote last and is waiting on a reply. */
  awaitingReply?: boolean;
  /** When they started waiting, for "waiting 12m". */
  waitingSince?: string | null;
  labels?: ChipLabel[];
  autoLabels?: string[];
}

/** "4m", "1h 20m", "2d": how long a player has waited for a reply. */
function waitFor(since: string, now: number): { text: string; level: 'ok' | 'warn' | 'late' } {
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  const level = minutes >= 60 ? 'late' : minutes >= 15 ? 'warn' : 'ok';
  if (minutes < 1) return { text: 'now', level };
  if (minutes < 60) return { text: `${minutes}m`, level };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { text: `${hours}h ${minutes % 60}m`, level };
  return { text: `${Math.floor(hours / 24)}d`, level };
}

/** The list of conversations: search, optional filters, then the rows. */
export function ConversationList({
  rows,
  selectedId,
  onSelect,
  search,
  onSearch,
  searchPlaceholder = 'Search',
  searchRef,
  toolbar,
  empty,
  footer,
  hasMore,
  loadingMore,
  onEndReached,
  now = Date.now(),
}: {
  rows: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  searchRef?: Ref<HTMLInputElement>;
  toolbar?: ReactNode;
  empty: ReactNode;
  footer?: ReactNode;
  hasMore?: boolean;
  loadingMore?: boolean;
  onEndReached?: () => void;
  /** Passed in so every row's wait time ticks from the same clock. */
  now?: number;
}) {
  const sentinel = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || !onEndReached) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onEndReached(), {
      rootMargin: '200px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onEndReached, rows.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-3 pb-2">
        <label className="bg-muted/70 focus-within:ring-ring/70 flex h-10 items-center gap-2 rounded-full px-3.5 focus-within:ring-[3px]">
          <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>
      {toolbar}

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="text-muted-foreground px-4 py-10 text-center text-sm">{empty}</li>
        ) : (
          rows.map((row) => {
            const wait =
              row.awaitingReply && row.waitingSince ? waitFor(row.waitingSince, now) : null;
            const hasChips = Boolean(row.labels?.length || row.autoLabels?.length);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  aria-current={row.id === selectedId ? 'true' : undefined}
                  className={cn(
                    'hover:bg-accent/60 focus-visible:bg-accent flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors outline-none',
                    row.id === selectedId && 'bg-accent',
                  )}
                >
                  <ChatAvatar
                    name={row.name}
                    src={row.avatarUrl}
                    online={row.online}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-[15px]',
                          row.unread > 0 ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {row.name}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-xs tabular-nums',
                          row.unread > 0 ? 'text-primary font-semibold' : 'text-muted-foreground',
                        )}
                      >
                        {listTime(row.time)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          row.typing
                            ? 'text-success font-medium'
                            : row.unread > 0
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                        )}
                      >
                        {row.typing ? 'typing…' : (row.preview ?? 'No messages yet')}
                      </span>
                      {row.unread > 0 && (
                        <span className="bg-primary text-primary-foreground grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
                          {row.unread > 99 ? '99+' : row.unread}
                        </span>
                      )}
                    </span>
                    {(hasChips || wait) && (
                      <span className="mt-1.5 flex items-center justify-between gap-2">
                        <LabelChips
                          labels={row.labels}
                          autoLabels={row.autoLabels}
                          max={2}
                          size="xs"
                        />
                        {wait && (
                          <span
                            className={cn(
                              'ml-auto shrink-0 text-[11px] font-semibold tabular-nums',
                              wait.level === 'late'
                                ? 'text-destructive'
                                : wait.level === 'warn'
                                  ? 'text-warning'
                                  : 'text-muted-foreground',
                            )}
                          >
                            Waiting {wait.text}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })
        )}
        {hasMore && (
          <li ref={sentinel} className="text-muted-foreground flex justify-center py-4">
            {loadingMore && (
              <Loader2Icon className="size-4 animate-spin" aria-label="Loading more" />
            )}
          </li>
        )}
      </ul>
      {footer}
    </div>
  );
}
