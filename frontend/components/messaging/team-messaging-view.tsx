'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeftIcon, RadioIcon, SearchIcon, UsersIcon, WifiOffIcon } from 'lucide-react';

import {
  listStaffContacts,
  listStaffConversations,
  loadStaffMessages,
  markStaffConversationRead,
  sendStaffMessage,
} from '@/app/(app)/messages/staff-actions';
import { MessageAttachments } from '@/components/messaging/message-attachments';
import { MessageComposer } from '@/components/messaging/message-composer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useMessagingSocket, type LiveStaffMessage } from '@/hooks/use-messaging-socket';
import { formatDateTime } from '@/lib/money';
import type { StaffContact, StaffConversation, StaffMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

const ROLE_LABEL: Record<string, string> = {
  master: 'Master',
  manager: 'Manager',
  runner: 'Runner',
};

/**
 * Internal DMs: master, managers and runners messaging each other directly,
 * entirely apart from customer conversations. Who shows up in "people" is
 * decided by the server (`/team/staff-conversations/contacts`), not here —
 * a runner only ever sees their own manager and any master, a manager their
 * own runners and any master, a master everyone.
 *
 * There is no existing thread until the first message is sent, so a
 * contact with no conversation yet is shown alongside real threads rather
 * than requiring a separate "start" step — picking them opens an empty
 * thread that becomes real on first send.
 */
export function TeamMessagingView({ actorId }: { actorId: string }) {
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, startSearch] = useTransition();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<StaffContact | null>(null);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null;

  const refresh = useCallback(() => {
    Promise.all([listStaffConversations(), listStaffContacts()])
      .then(([convos, people]) => {
        setConversations(convos);
        setContacts(people);
      })
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setTimeout(() => {
      startSearch(async () => setContacts(await listStaffContacts(search)));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleIncoming = useCallback(
    (message: LiveStaffMessage) => {
      setConversations((current) => {
        const known = current.some((c) => c.id === message.conversationId);
        if (!known) {
          refresh();
          return current;
        }
        return current.map((conversation) =>
          conversation.id === message.conversationId
            ? {
                ...conversation,
                lastMessagePreview: message.body,
                lastMessageAt: message.createdAt,
                messageCount: conversation.messageCount + 1,
                unreadCount:
                  conversation.id === selectedConversationId
                    ? conversation.unreadCount
                    : conversation.unreadCount + 1,
              }
            : conversation,
        );
      });

      if (message.conversationId === selectedConversationId) {
        setMessages((current) =>
          current.some((existing) => existing.id === message.id) ? current : [...current, message],
        );
      }
    },
    [refresh, selectedConversationId],
  );

  const { state } = useMessagingSocket(() => {}, handleIncoming);

  // The set of contacts already covered by a real conversation, so they are
  // not shown twice.
  const conversationCounterparts = useMemo(
    () => new Set(conversations.map((c) => c.counterpartId)),
    [conversations],
  );

  const visibleConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(
      (c) =>
        c.counterpartUsername.toLowerCase().includes(query) ||
        c.counterpartFullName?.toLowerCase().includes(query) ||
        c.lastMessagePreview?.toLowerCase().includes(query),
    );
  }, [conversations, search]);

  const startableContacts = useMemo(
    () => contacts.filter((contact) => !conversationCounterparts.has(contact.id)),
    [contacts, conversationCounterparts],
  );

  const openConversation = async (conversation: StaffConversation) => {
    setSelectedConversationId(conversation.id);
    setSelectedContact(null);
    setLoadingThread(true);
    setMessages(await loadStaffMessages(conversation.id));
    setLoadingThread(false);

    if (conversation.unreadCount > 0) {
      setConversations((current) =>
        current.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c)),
      );
      void markStaffConversationRead(conversation.id);
    }
  };

  const openContact = (contact: StaffContact) => {
    setSelectedConversationId(null);
    setSelectedContact(contact);
    setMessages([]);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeName = selectedConversation
    ? (selectedConversation.counterpartFullName ?? selectedConversation.counterpartUsername)
    : (selectedContact?.fullName ?? selectedContact?.username ?? '');
  const activeUsername = selectedConversation?.counterpartUsername ?? selectedContact?.username;
  const targetStaffId = selectedConversation?.counterpartId ?? selectedContact?.id ?? null;

  return (
    <div className="grid h-[calc(100svh-8rem)] overflow-hidden rounded-xl border md:grid-cols-[320px_1fr]">
      <aside
        className={cn(
          'flex min-h-0 flex-col border-r',
          selectedConversationId || selectedContact ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="space-y-2 border-b p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Team</span>
            <ConnectionBadge state={state} />
          </div>
          <div className="relative">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              {visibleConversations.length > 0 ? (
                <div>
                  {visibleConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => void openConversation(conversation)}
                      className={cn(
                        'hover:bg-accent/50 flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors',
                        conversation.id === selectedConversationId && 'bg-accent',
                      )}
                    >
                      <Avatar className="mt-0.5 size-9 shrink-0">
                        <AvatarFallback className="text-xs">
                          {initials(
                            conversation.counterpartFullName || conversation.counterpartUsername,
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {conversation.counterpartUsername}
                          </span>
                          {conversation.unreadCount > 0 ? (
                            <Badge className="tabular h-5 px-1.5">{conversation.unreadCount}</Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">
                          {conversation.lastMessagePreview ?? 'No messages yet.'}
                        </p>
                        <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px]">
                          {ROLE_LABEL[conversation.counterpartRole] ?? conversation.counterpartRole}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {startableContacts.length > 0 ? (
                <div>
                  <div className="text-muted-foreground flex items-center gap-1.5 border-b px-3 py-1.5 text-[11px] font-medium">
                    <UsersIcon className="size-3" />
                    {searching ? 'Searching…' : 'Start a conversation'}
                  </div>
                  {startableContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => openContact(contact)}
                      className={cn(
                        'hover:bg-accent/50 flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left transition-colors',
                        selectedContact?.id === contact.id && 'bg-accent',
                      )}
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="text-xs">
                          {initials(contact.fullName || contact.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {contact.username}
                        </span>
                        <Badge variant="outline" className="mt-0.5 h-5 px-1.5 text-[10px]">
                          {ROLE_LABEL[contact.role] ?? contact.role}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {visibleConversations.length === 0 && startableContacts.length === 0 ? (
                <p className="text-muted-foreground p-4 text-center text-sm">
                  {search ? 'No one matches that search.' : 'No one to message yet.'}
                </p>
              ) : null}
            </>
          )}
        </div>
      </aside>

      <section
        className={cn(
          'bg-muted/20 flex min-h-0 flex-col',
          selectedConversationId || selectedContact ? 'flex' : 'hidden md:flex',
        )}
      >
        {targetStaffId ? (
          <>
            <header className="bg-background flex items-center gap-2 border-b px-3 py-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 md:hidden"
                aria-label="Back to people"
                onClick={() => {
                  setSelectedConversationId(null);
                  setSelectedContact(null);
                }}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(activeName || '?')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{activeUsername}</p>
                {activeName && activeName !== activeUsername ? (
                  <p className="text-muted-foreground truncate text-xs">{activeName}</p>
                ) : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {loadingThread ? (
                <>
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="ml-auto h-12 w-1/2" />
                </>
              ) : messages.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Send a message to start the conversation.
                </p>
              ) : (
                messages.map((message) => (
                  <Bubble
                    key={message.id}
                    message={message}
                    fromSelf={message.senderStaffId === actorId}
                  />
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <MessageComposer
              uploadUrl="/api/messages/attachments"
              placeholder={`Message ${activeUsername}…`}
              sending={sending}
              onSend={async (body, attachments) => {
                setSending(true);
                const result = await sendStaffMessage(targetStaffId, body, attachments);
                setSending(false);

                if (result.ok && result.data) {
                  setMessages((current) =>
                    current.some((existing) => existing.id === result.data!.id)
                      ? current
                      : [...current, result.data!],
                  );
                  // First send to a contact with no thread yet — refresh so
                  // the new conversation appears in the list on its own.
                  if (!selectedConversation) {
                    setSelectedConversationId(result.data.conversationId);
                    refresh();
                  }
                  return true;
                }
                return false;
              }}
            />
          </>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
            Choose someone to message.
          </div>
        )}
      </section>
    </div>
  );
}

function Bubble({ message, fromSelf }: { message: StaffMessage; fromSelf: boolean }) {
  const hasAttachments = Boolean(message.attachments?.length);
  const hasBody = message.body.trim().length > 0;

  return (
    <div className={cn('flex', fromSelf ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'w-max max-w-[80%] space-y-1.5 rounded-2xl px-3.5 py-2.5 shadow-sm',
          fromSelf
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-background rounded-bl-sm',
        )}
      >
        {hasBody ? <p className="text-sm whitespace-pre-wrap">{message.body}</p> : null}
        {hasAttachments ? (
          <MessageAttachments attachments={message.attachments!} fromSelf={fromSelf} />
        ) : null}
        <p
          className={cn(
            'text-[10px]',
            fromSelf ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          {fromSelf ? 'You' : message.senderUsername} · {formatDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

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
