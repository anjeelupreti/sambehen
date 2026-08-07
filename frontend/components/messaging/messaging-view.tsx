'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon, RadioIcon, SearchIcon, WifiOffIcon } from 'lucide-react';

import { loadMessages, markConversationRead, sendMessage } from '@/app/(app)/messages/actions';
import { MessageAttachments } from '@/components/messaging/message-attachments';
import { MessageComposer } from '@/components/messaging/message-composer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useMessagingSocket, type LiveMessage } from '@/hooks/use-messaging-socket';
import { formatDateTime } from '@/lib/money';
import type { Conversation, Message } from '@/lib/types';
import { cn } from '@/lib/utils';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

/**
 * The messaging surface: search, the people, the conversation. Nothing
 * else — a filter bar and a row of stat tiles used to sit above this, but
 * a page for reading and replying to messages isn't a report, and search
 * belongs next to the list it searches rather than as a page-level filter
 * that reloads the route.
 *
 * Threads live beside the list on desktop and replace it below `md` — a
 * two-pane layout on a phone gives neither pane enough room to be usable.
 *
 * Arrivals are applied optimistically to the list (preview, timestamp,
 * unread count) rather than triggering a refetch. A refetch on every
 * message would reorder the list under someone mid-read.
 */
export function MessagingView({ initialConversations }: { initialConversations: Conversation[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const bottomRef = useRef<HTMLDivElement>(null);

  // The server component re-renders on revalidation; adopt its list without
  // discarding a thread the user is reading.
  useEffect(() => setConversations(initialConversations), [initialConversations]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(
      (c) =>
        c.customerUsername?.toLowerCase().includes(query) ||
        c.customerFullName?.toLowerCase().includes(query) ||
        c.lastMessagePreview?.toLowerCase().includes(query),
    );
  }, [conversations, search]);

  const handleIncoming = useCallback(
    (message: LiveMessage) => {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === message.conversationId
            ? {
                ...conversation,
                lastMessagePreview: message.body,
                lastMessageAt: message.createdAt,
                messageCount: conversation.messageCount + 1,
                // Anything arriving in the thread on screen has been seen.
                unreadCount:
                  conversation.id === selectedId
                    ? conversation.unreadCount
                    : conversation.unreadCount + 1,
                awaitingReply: message.senderType === 'customer',
              }
            : conversation,
        ),
      );

      if (message.conversationId === selectedId) {
        setMessages((current) =>
          // The sender also receives their own message back over the socket;
          // without this the thread shows it twice.
          current.some((existing) => existing.id === message.id) ? current : [...current, message],
        );
      }
    },
    [selectedId],
  );

  const { state } = useMessagingSocket(handleIncoming);

  const open = async (conversation: Conversation) => {
    setSelectedId(conversation.id);
    setLoadingThread(true);
    setMessages(await loadMessages(conversation.id));
    setLoadingThread(false);

    if (conversation.unreadCount > 0) {
      setConversations((current) =>
        current.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c)),
      );
      void markConversationRead(conversation.id);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="grid h-[calc(100svh-8rem)] overflow-hidden rounded-xl border md:grid-cols-[320px_1fr]">
      <aside
        className={cn('flex min-h-0 flex-col border-r', selectedId ? 'hidden md:flex' : 'flex')}
      >
        <div className="space-y-2 border-b p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Messages</span>
            <ConnectionBadge state={state} />
          </div>
          <div className="relative">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people or messages…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              {search ? 'No one matches that search.' : 'No conversations yet.'}
            </p>
          ) : (
            visible.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void open(conversation)}
                className={cn(
                  'hover:bg-accent/50 flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors',
                  conversation.id === selectedId && 'bg-accent',
                )}
              >
                <Avatar className="mt-0.5 size-9 shrink-0">
                  <AvatarFallback className="text-xs">
                    {initials(
                      conversation.customerFullName || conversation.customerUsername || '?',
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {conversation.customerUsername}
                    </span>
                    {conversation.unreadCount > 0 ? (
                      <Badge className="tabular h-5 px-1.5">{conversation.unreadCount}</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {conversation.lastMessagePreview ?? 'No messages yet.'}
                  </p>
                  {conversation.awaitingReply ? (
                    <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px]">
                      awaiting reply
                    </Badge>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section
        className={cn('bg-muted/20 flex min-h-0 flex-col', selectedId ? 'flex' : 'hidden md:flex')}
      >
        {selected ? (
          <>
            <header className="bg-background flex items-center gap-2 border-b px-3 py-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 md:hidden"
                aria-label="Back to conversations"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  {initials(selected.customerFullName || selected.customerUsername || '?')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selected.customerUsername}</p>
                {selected.customerFullName ? (
                  <p className="text-muted-foreground truncate text-xs">
                    {selected.customerFullName}
                  </p>
                ) : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {loadingThread ? (
                <>
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="ml-auto h-12 w-1/2" />
                  <Skeleton className="h-12 w-3/5" />
                </>
              ) : messages.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No messages in this thread yet.
                </p>
              ) : (
                messages.map((message) => <Bubble key={message.id} message={message} />)
              )}
              <div ref={bottomRef} />
            </div>

            <MessageComposer
              uploadUrl="/api/messages/attachments"
              placeholder={`Reply to ${selected.customerUsername}…`}
              sending={sending}
              onSend={async (body, attachments) => {
                setSending(true);
                const result = await sendMessage(selected.customerId, body, attachments);
                setSending(false);

                if (result.ok && result.data) {
                  setMessages((current) =>
                    current.some((existing) => existing.id === result.data!.id)
                      ? current
                      : [...current, result.data!],
                  );
                  return true;
                }
                return false;
              }}
            />
          </>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
            Choose a conversation to read it.
          </div>
        )}
      </section>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const fromCustomer = message.senderType === 'customer';
  const hasAttachments = Boolean(message.attachments?.length);
  const hasBody = message.body.trim().length > 0;

  return (
    <div className={cn('flex', fromCustomer ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[80%] space-y-1.5 rounded-2xl px-3.5 py-2.5 shadow-sm',
          fromCustomer
            ? 'bg-background rounded-bl-sm'
            : 'bg-primary text-primary-foreground rounded-br-sm',
        )}
      >
        {hasBody ? <p className="text-sm whitespace-pre-wrap">{message.body}</p> : null}
        {hasAttachments ? (
          <MessageAttachments attachments={message.attachments!} fromSelf={!fromCustomer} />
        ) : null}
        <p
          className={cn(
            'text-[10px]',
            fromCustomer ? 'text-muted-foreground' : 'text-primary-foreground/70',
          )}
        >
          {/* Which staff member replied is recorded and shown up the chain —
              a manager reading their runner's thread needs to know who
              answered. */}
          {!fromCustomer && message.senderStaffUsername ? `${message.senderStaffUsername} · ` : ''}
          {formatDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

/**
 * Says plainly whether messages are arriving live.
 *
 * When the socket is down the page still works over HTTP, but new messages
 * will not appear on their own — and silence must not be mistaken for "no
 * new messages".
 */
function ConnectionBadge({ state }: { state: 'connecting' | 'live' | 'offline' }) {
  if (state === 'live') {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <RadioIcon className="size-3 text-green-600 dark:text-green-500" />
        Live
      </span>
    );
  }

  if (state === 'connecting') {
    return <span className="text-muted-foreground text-xs">Connecting…</span>;
  }

  return (
    <span
      className="text-muted-foreground flex items-center gap-1 text-xs"
      title="New messages will not appear until you refresh."
    >
      <WifiOffIcon className="size-3" />
      Not live
    </span>
  );
}
