'use client';

import type { ReactNode } from 'react';
import { SearchIcon } from 'lucide-react';

import { ChatAvatar } from './avatar';
import { listTime } from './format';
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
}

/** The list of conversations: search on top, newest first. */
export function ConversationList({
  rows,
  selectedId,
  onSelect,
  search,
  onSearch,
  searchPlaceholder = 'Search',
  empty,
  footer,
}: {
  rows: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  empty: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-3">
        <label className="bg-muted/70 focus-within:ring-ring/70 flex h-10 items-center gap-2 rounded-full px-3.5 focus-within:ring-[3px]">
          <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="text-muted-foreground px-4 py-10 text-center text-sm">{empty}</li>
        ) : (
          rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                aria-current={row.id === selectedId ? 'true' : undefined}
                className={cn(
                  'hover:bg-accent/60 focus-visible:bg-accent flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors outline-none',
                  row.id === selectedId && 'bg-accent',
                )}
              >
                <ChatAvatar name={row.name} src={row.avatarUrl} online={row.online} />
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
                      // Rendered on the server in its timezone, then in the viewer's.
                      suppressHydrationWarning
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
                    {row.unread > 0 ? (
                      <span className="bg-primary text-primary-foreground grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
                        {row.unread > 99 ? '99+' : row.unread}
                      </span>
                    ) : row.awaitingReply ? (
                      <span className="text-warning shrink-0 text-[11px] font-semibold">
                        Awaiting reply
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
      {footer}
    </div>
  );
}
