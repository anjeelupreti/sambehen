'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLineIcon, MailIcon, MessagesSquareIcon, PanelRightIcon } from 'lucide-react';
import { toast } from 'sonner';

import {
  listInbox,
  loadThread,
  markConversationRead,
  markConversationUnread,
  sendReply,
  type InboxPage,
} from '@/app/(app)/messages/actions';
import { listInboxScopes, listLabels, type Label } from '@/app/(app)/messages/label-actions';
import { ConversationList, type ConversationRow } from '@/components/chat/conversation-list';
import type { ChipLabel } from '@/components/chat/label-chips';
import { fromCustomerThreadForStaff } from '@/components/chat/mappers';
import { ChatPane } from '@/components/chat/pane';
import { useChatSocket, useSocketEvent } from '@/components/chat/socket';
import { useChatThread } from '@/components/chat/use-chat-thread';
import { useTypingMap } from '@/components/chat/use-typing-map';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { Conversation, ConversationSummary, Message, Staff } from '@/lib/types';
import { cn } from '@/lib/utils';
import { InboxToolbar, type InboxFilters } from './inbox-toolbar';
import { ManageLabelsDialog } from './manage-labels-dialog';
import { PlayerPanel } from './player-panel';

type LiveMessage = Message & { conversationId: string; customerId: string };

export interface InboxViewer {
  id: string;
  username: string;
  role: string;
}

const DEFAULT_FILTERS: InboxFilters = {
  chip: 'all',
  sort: 'attention',
  labelId: '',
  storeId: '',
  managerId: '',
};

const time = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

/** The same order the API uses, so live updates land where a refresh would put them. */
function orderFor(sort: InboxFilters['sort']) {
  return (a: Conversation, b: Conversation) => {
    if (sort !== 'recent') {
      if (sort === 'attention' && a.unreadCount > 0 !== b.unreadCount > 0) {
        return a.unreadCount > 0 ? -1 : 1;
      }
      if (a.awaitingReply !== b.awaitingReply) return a.awaitingReply ? -1 : 1;
      if (a.awaitingReply && b.awaitingReply) {
        const wait = time(a.waitingSince) - time(b.waitingSince);
        if (wait !== 0) return wait;
      }
    }
    return time(b.lastMessageAt) - time(a.lastMessageAt);
  };
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Staff conversations with players, built for busy days: filter chips with
 * live counts, a "needs attention" sort, labels, a player panel beside the
 * chat, keyboard moves and a jump to the next player who is waiting.
 * `compact` is the single-pane version the floating chat uses.
 */
export function MessagingView({
  initialConversations,
  viewer,
  compact,
  onUnreadChange,
}: {
  initialConversations?: Conversation[];
  viewer: InboxViewer;
  compact?: boolean;
  onUnreadChange?: (unread: number) => void;
}) {
  const { state, emit, presence, requestPresence } = useChatSocket();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations ?? []);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [scopes, setScopes] = useState<{ managers: Staff[]; stores: Staff[] }>({
    managers: [],
    stores: [],
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const typing = useTypingMap();
  const isMaster = viewer.role === 'master';

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Wait times tick once a minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const refreshLabels = useCallback(() => void listLabels().then(setLabels), []);
  useEffect(() => {
    refreshLabels();
    if (viewer.role !== 'store') void listInboxScopes().then(setScopes);
  }, [refreshLabels, viewer.role]);

  const apply = useCallback((result: InboxPage, append: boolean) => {
    setConversations((current) => {
      if (!append) return result.data;
      const known = new Set(current.map((c) => c.id));
      return [...current, ...result.data.filter((c) => !known.has(c.id))];
    });
    setHasMore(result.hasMore);
    if (result.summary) setSummary(result.summary);
  }, []);

  // First page whenever the filters or search change.
  useEffect(() => {
    const id = ++request.current;
    setPage(1);
    void listInbox({ ...filters, search: query, page: 1 }).then((result) => {
      if (id === request.current) apply(result, false);
    });
  }, [filters, query, apply]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    const id = request.current;
    void listInbox({ ...filters, search: query, page: next })
      .then((result) => {
        if (id !== request.current) return;
        setPage(next);
        apply(result, true);
      })
      .finally(() => setLoadingMore(false));
  }, [apply, filters, hasMore, loadingMore, page, query]);

  // Chip counts follow live traffic without reloading the list under the reader.
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSummary = useCallback(() => {
    if (summaryTimer.current) clearTimeout(summaryTimer.current);
    summaryTimer.current = setTimeout(() => {
      void listInbox({ ...filters, search: query, page: 1 }).then((result) => {
        if (result.summary) setSummary(result.summary);
      });
    }, 1500);
  }, [filters, query]);

  useEffect(() => {
    onUnreadChange?.(
      summary?.unreadConversations ?? conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    );
  }, [summary, conversations, onUnreadChange]);

  const customerIds = useMemo(
    () => conversations.map((c) => c.customerId).join(','),
    [conversations],
  );
  useEffect(() => {
    if (state === 'live' && customerIds) requestPresence({ customerIds: customerIds.split(',') });
  }, [state, customerIds, requestPresence]);

  const thread = useChatThread({
    key: selected?.id ?? null,
    load: (before) => loadThread(selected!.id, before),
    send: (body, attachments) => sendReply(selected!.customerId, body, attachments),
  });

  useSocketEvent<LiveMessage>('message:new', (message) => {
    const fromPlayer = message.senderType === 'customer';
    refreshSummary();
    if (!conversations.some((c) => c.id === message.conversationId)) {
      // A conversation not on screen: bring the first page up to date.
      const id = ++request.current;
      void listInbox({ ...filters, search: query, page: 1 }).then((result) => {
        if (id === request.current) apply(result, false);
      });
      return;
    }
    const open = message.conversationId === selectedId;
    setConversations((current) =>
      current
        .map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                lastMessagePreview: previewOf(message),
                lastMessageAt: message.createdAt,
                messageCount: c.messageCount + 1,
                unreadCount: open || !fromPlayer ? c.unreadCount : c.unreadCount + 1,
                awaitingReply: fromPlayer,
                waitingSince: fromPlayer
                  ? c.awaitingReply
                    ? c.waitingSince
                    : message.createdAt
                  : null,
              }
            : c,
        )
        .sort(orderFor(filters.sort)),
    );
    if (open) {
      thread.receive(fromCustomerThreadForStaff(message, viewer.username));
      if (fromPlayer) void markConversationRead(message.conversationId);
    }
    if (fromPlayer) typing.set(message.customerId, false);
  });

  useSocketEvent<{ customerId: string; isTyping: boolean }>('typing', ({ customerId, isTyping }) =>
    typing.set(customerId, isTyping),
  );

  useSocketEvent<{ conversationId: string; readAt: string }>('conversation:read', (event) => {
    if (event.conversationId === selectedId) thread.setReadAt(event.readAt);
  });

  const open = useCallback(
    (id: string) => {
      setSelectedId(id);
      setConversations((current) =>
        current.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
      );
      refreshSummary();
    },
    [refreshSummary],
  );

  const nextWaiting = useCallback(() => {
    const next = conversations.find((c) => c.awaitingReply && c.id !== selectedId);
    if (next) open(next.id);
    else toast.success('Nobody else is waiting for a reply.');
  }, [conversations, open, selectedId]);

  const markUnread = useCallback(async () => {
    if (!selected) return;
    const ok = await markConversationUnread(selected.id);
    if (!ok) {
      toast.error('Couldn’t mark it unread.');
      return;
    }
    setConversations((current) =>
      current.map((c) =>
        c.id === selected.id ? { ...c, unreadCount: Math.max(1, c.unreadCount) } : c,
      ),
    );
    setSelectedId(null);
    refreshSummary();
  }, [refreshSummary, selected]);

  // J/K move through the list, / searches, Esc closes the conversation.
  useEffect(() => {
    if (compact) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' && selectedId && !isTypingTarget(event.target)) {
        setSelectedId(null);
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key !== 'j' && event.key !== 'k') return;
      if (!conversations.length) return;
      const index = conversations.findIndex((c) => c.id === selectedId);
      const nextIndex =
        event.key === 'j' ? Math.min(conversations.length - 1, index + 1) : Math.max(0, index - 1);
      open(conversations[index === -1 ? 0 : nextIndex].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact, conversations, open, selectedId]);

  const setRowLabels = useCallback(
    (customerId: string, next: ChipLabel[]) => {
      setConversations((current) =>
        current.map((c) =>
          c.customerId === customerId ? { ...c, labels: next as Conversation['labels'] } : c,
        ),
      );
      refreshLabels();
    },
    [refreshLabels],
  );

  const rows: ConversationRow[] = useMemo(
    () =>
      conversations.map((c) => ({
        id: c.id,
        name: c.customerFullName || c.customerUsername || 'Customer',
        avatarUrl: c.customerAvatarUrl,
        preview: c.lastMessagePreview,
        time: c.lastMessageAt,
        unread: c.unreadCount,
        awaitingReply: c.awaitingReply,
        waitingSince: c.waitingSince,
        labels: c.labels,
        autoLabels: c.autoLabels,
        online: presence[`customer:${c.customerId}`]?.online,
        typing: typing.isTyping(c.customerId),
      })),
    [conversations, presence, typing],
  );

  const headerButton =
    'hover:bg-accent focus-visible:ring-ring/70 grid size-9 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px]';
  const pane = selected ? (
    <ChatPane
      title={selected.customerFullName || selected.customerUsername || 'Customer'}
      avatarUrl={selected.customerAvatarUrl}
      presence={presence[`customer:${selected.customerId}`]}
      typing={typing.isTyping(selected.customerId)}
      thread={thread}
      uploadUrl="/api/messages/attachments"
      onTyping={(isTyping) => emit('typing', { customerId: selected.customerId, isTyping })}
      onBack={() => setSelectedId(null)}
      compact={compact}
      actions={
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={nextWaiting}
            className="hover:bg-accent focus-visible:ring-ring/70 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none focus-visible:ring-[3px]"
          >
            <ArrowDownToLineIcon className="size-4" />
            <span className="hidden sm:inline">Next waiting</span>
          </button>
          <button
            type="button"
            onClick={() => void markUnread()}
            aria-label="Mark as unread"
            title="Mark as unread"
            className={headerButton}
          >
            <MailIcon className="size-4" />
          </button>
          {!compact && (
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia('(min-width: 1280px)').matches)
                  setPanelOpen((value) => !value);
                else setSheetOpen(true);
              }}
              aria-label="Player details"
              title="Player details"
              aria-pressed={panelOpen}
              className={headerButton}
            >
              <PanelRightIcon className="size-4" />
            </button>
          )}
        </div>
      }
    />
  ) : null;

  const list = (
    <ConversationList
      rows={rows}
      selectedId={selectedId}
      onSelect={open}
      search={search}
      onSearch={setSearch}
      searchRef={searchRef}
      searchPlaceholder="Search players or messages"
      toolbar={
        <InboxToolbar
          filters={filters}
          onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
          summary={summary}
          labels={labels}
          scopes={scopes}
          onManageLabels={isMaster ? () => setManageOpen(true) : undefined}
        />
      }
      empty={
        search || filters.chip !== 'all' || filters.labelId || filters.storeId || filters.managerId
          ? 'No conversations match these filters.'
          : 'No conversations yet.'
      }
      hasMore={hasMore}
      loadingMore={loadingMore}
      onEndReached={loadMore}
      now={now}
    />
  );

  const panel = selected ? (
    <PlayerPanel
      customerId={selected.customerId}
      labels={labels}
      onLabelsChange={setRowLabels}
      onManageLabels={isMaster ? () => setManageOpen(true) : undefined}
    />
  ) : null;

  const dialogs = (
    <>
      {isMaster && (
        <ManageLabelsDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          labels={labels}
          onChanged={() => {
            refreshLabels();
            const id = ++request.current;
            void listInbox({ ...filters, search: query, page: 1 }).then((result) => {
              if (id === request.current) apply(result, false);
            });
          }}
        />
      )}
    </>
  );

  if (compact) {
    return (
      <>
        {selected ? pane : list}
        {dialogs}
      </>
    );
  }

  const showPanel = Boolean(selected && panelOpen);
  return (
    <div
      className={cn(
        'bg-background grid h-full min-h-0 overflow-hidden md:grid-cols-[minmax(300px,380px)_1fr]',
        showPanel && 'xl:grid-cols-[minmax(300px,380px)_1fr_320px]',
      )}
    >
      <aside className={cn('flex min-h-0 flex-col border-r', selected ? 'hidden md:flex' : 'flex')}>
        {list}
      </aside>
      <div className={cn('min-h-0 flex-col', selected ? 'flex' : 'hidden md:flex')}>
        {pane ?? <NoConversation />}
      </div>
      {showPanel && <aside className="hidden min-h-0 border-l xl:block">{panel}</aside>}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[340px] p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Player details</SheetTitle>
          {panel}
        </SheetContent>
      </Sheet>
      {dialogs}
    </div>
  );
}

export function NoConversation() {
  return (
    <div className="chat-wallpaper text-muted-foreground grid h-full place-items-center">
      <span className="flex flex-col items-center gap-3 text-sm">
        <MessagesSquareIcon className="size-10 opacity-40" aria-hidden />
        Select a conversation
        <span className="text-xs opacity-80">
          <kbd className="bg-background rounded border px-1">J</kbd> /{' '}
          <kbd className="bg-background rounded border px-1">K</kbd> to move,{' '}
          <kbd className="bg-background rounded border px-1">/</kbd> to search
        </span>
      </span>
    </div>
  );
}

export function previewOf(message: {
  body: string;
  attachments?: { mimeType: string }[] | null;
}): string {
  if (message.body.trim()) return message.body;
  const count = message.attachments?.length ?? 0;
  if (count === 0) return '';
  const images = message.attachments!.every((a) => a.mimeType.startsWith('image/'));
  return images
    ? count === 1
      ? 'Photo'
      : `${count} photos`
    : count === 1
      ? 'File'
      : `${count} files`;
}
