'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  Maximize2Icon,
  MessageSquareIcon,
  RadioIcon,
  UsersIcon,
  WifiOffIcon,
  XIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { MessageAttachments } from '@/components/messaging/message-attachments';
import { MessageComposer } from '@/components/messaging/message-composer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import {
  getConversations,
  getMessages,
  markAsRead,
  sendMessage,
} from '@/app/(app)/messages/actions';
import {
  listStaffContacts,
  listStaffConversations,
  loadStaffMessages,
  markStaffConversationRead,
  sendStaffMessage,
} from '@/app/(app)/messages/staff-actions';
import {
  useMessagingSocket,
  type LiveMessage,
  type LiveStaffMessage,
} from '@/hooks/use-messaging-socket';
import { cn } from '@/lib/utils';
import type {
  Conversation,
  Message,
  StaffContact,
  StaffConversation,
  StaffMessage,
} from '@/lib/types';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

type View = 'customers' | 'team';

/**
 * The chat bubble. Same inbox and threads as the full `/messages` page —
 * this is the compact surface for staying on top of things without leaving
 * whatever page you're on, with a link out to the full page for anyone who
 * wants more room. Shares MessageComposer with the full page, so an
 * attachment sent from either surface behaves identically.
 *
 * Two inboxes share this one bubble: customer conversations (Inbox) and
 * internal staff DMs (Team). They toggle rather than sit side by side —
 * there is not enough width here for two panes, unlike the full page.
 *
 * Arrivals come over the socket, not a poll: `useMessagingSocket` is the
 * same hook the full page uses, so a message shows up here the instant it
 * shows up there. The 30s fetch is a fallback for while the socket is
 * reconnecting, not the primary path — it stands down once the connection
 * is live.
 */
export function MessagesFab({ role: _role, actorId }: { role: string; actorId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>('customers');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);

  const [teamConversations, setTeamConversations] = useState<StaffConversation[]>([]);
  const [teamContacts, setTeamContacts] = useState<StaffContact[]>([]);
  const [activeThread, setActiveThread] = useState<StaffConversation | null>(null);
  const [activeContact, setActiveContact] = useState<StaffContact | null>(null);
  const [teamMessages, setTeamMessages] = useState<StaffMessage[]>([]);
  const [teamSending, setTeamSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeCustomer?.id ?? null;
  }, [activeCustomer]);

  const activeThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeThreadIdRef.current = activeThread?.id ?? null;
  }, [activeThread]);

  const refresh = useCallback(() => {
    getConversations()
      .then(setConversations)
      .catch(() => {});
  }, []);

  const refreshTeam = useCallback(() => {
    Promise.all([listStaffConversations(), listStaffContacts()])
      .then(([convos, people]) => {
        setTeamConversations(convos);
        setTeamContacts(people);
      })
      .catch(() => {});
  }, []);

  // Seeds both lists once on mount — the socket only reports what arrives
  // *after* it connects, not what was already unread.
  useEffect(() => {
    refresh();
    refreshTeam();
  }, [refresh, refreshTeam]);

  const handleIncoming = useCallback(
    (message: LiveMessage) => {
      setConversations((current) => {
        const known = current.some((c) => c.id === message.conversationId);
        // A brand new conversation carries no username or preview over the
        // socket, so it is fetched properly rather than rendered half-empty.
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
                  conversation.id === activeIdRef.current
                    ? conversation.unreadCount
                    : conversation.unreadCount + 1,
                awaitingReply: message.senderType === 'customer',
              }
            : conversation,
        );
      });

      if (message.conversationId === activeIdRef.current) {
        setMessages((current) =>
          current.some((existing) => existing.id === message.id) ? current : [...current, message],
        );
      }
    },
    [refresh],
  );

  const handleIncomingTeam = useCallback(
    (message: LiveStaffMessage) => {
      setTeamConversations((current) => {
        const known = current.some((c) => c.id === message.conversationId);
        if (!known) {
          refreshTeam();
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
                  conversation.id === activeThreadIdRef.current
                    ? conversation.unreadCount
                    : conversation.unreadCount + 1,
              }
            : conversation,
        );
      });

      if (message.conversationId === activeThreadIdRef.current) {
        setTeamMessages((current) =>
          current.some((existing) => existing.id === message.id) ? current : [...current, message],
        );
      }
    },
    [refreshTeam],
  );

  const { state } = useMessagingSocket(handleIncoming, handleIncomingTeam);

  // Fallback only: while the socket is not live, nothing pushes updates, so
  // this covers reconnect gaps. Once `state === 'live'` the socket is the
  // only source — polling on top of it would just re-sort the list under
  // someone mid-read for no reason.
  useEffect(() => {
    if (state === 'live') return;
    const interval = setInterval(() => {
      refresh();
      refreshTeam();
    }, 30000);
    return () => clearInterval(interval);
  }, [state, refresh, refreshTeam]);

  useEffect(() => {
    if (activeCustomer) {
      getMessages(activeCustomer.id)
        .then((thread) => {
          setMessages(thread);

          if (activeCustomer.unreadCount > 0) {
            void markAsRead(activeCustomer.id);
            setConversations((current) =>
              current.map((c) => (c.id === activeCustomer.id ? { ...c, unreadCount: 0 } : c)),
            );
          }
        })
        .catch(console.error);
    }
  }, [activeCustomer]);

  useEffect(() => {
    if (activeThread) {
      loadStaffMessages(activeThread.id)
        .then((thread) => {
          setTeamMessages(thread);

          if (activeThread.unreadCount > 0) {
            void markStaffConversationRead(activeThread.id);
            setTeamConversations((current) =>
              current.map((c) => (c.id === activeThread.id ? { ...c, unreadCount: 0 } : c)),
            );
          }
        })
        .catch(console.error);
    }
  }, [activeThread]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, teamMessages]);

  const unreadCount =
    conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0) +
    teamConversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);

  const teamCounterparts = new Set(teamConversations.map((c) => c.counterpartId));
  const startableContacts = teamContacts.filter((c) => !teamCounterparts.has(c.id));
  const teamTargetId = activeThread?.counterpartId ?? activeContact?.id ?? null;
  const teamTargetName = activeThread?.counterpartUsername ?? activeContact?.username ?? '';

  const closeThreads = () => {
    setActiveCustomer(null);
    setActiveThread(null);
    setActiveContact(null);
  };

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end">
      {isOpen && (
        <Card className="animate-in slide-in-from-bottom-5 mb-4 flex h-[560px] w-[360px] flex-col overflow-hidden border-none py-0 shadow-2xl sm:w-[400px]">
          <div className="bg-primary text-primary-foreground flex shrink-0 items-center justify-between px-3 py-3">
            {activeCustomer || teamTargetId ? (
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-primary-foreground/15 size-8 shrink-0 text-current"
                  onClick={closeThreads}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback className="bg-primary-foreground/15 text-primary-foreground text-[11px]">
                    {activeCustomer
                      ? initials(
                          activeCustomer.customerFullName || activeCustomer.customerUsername || '?',
                        )
                      : initials(teamTargetName || '?')}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">
                  {activeCustomer ? activeCustomer.customerUsername : teamTargetName}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 pl-1">
                <button
                  type="button"
                  onClick={() => setView('customers')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition-colors',
                    view === 'customers'
                      ? 'bg-primary-foreground/15'
                      : 'opacity-70 hover:opacity-100',
                  )}
                >
                  <MessageSquareIcon className="size-4" />
                  Inbox
                </button>
                <button
                  type="button"
                  onClick={() => setView('team')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition-colors',
                    view === 'team' ? 'bg-primary-foreground/15' : 'opacity-70 hover:opacity-100',
                  )}
                >
                  <UsersIcon className="size-4" />
                  Team
                </button>
                <ConnectionDot state={state} />
              </div>
            )}
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="hover:bg-primary-foreground/15 size-8 text-current"
                aria-label="Open full messages page"
                title="Open full page"
              >
                <Link href="/messages">
                  <Maximize2Icon className="size-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-primary-foreground/15 size-8 text-current"
                onClick={() => setIsOpen(false)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted/20 relative flex-1 overflow-hidden">
            {view === 'customers' ? (
              !activeCustomer ? (
                <ScrollArea className="h-full">
                  <div className="space-y-0.5 p-2">
                    {conversations.length === 0 ? (
                      <div className="text-muted-foreground p-8 text-center text-sm">
                        No conversations yet.
                      </div>
                    ) : (
                      conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setActiveCustomer(conv)}
                          className="hover:bg-accent flex w-full items-start gap-2.5 rounded-md p-2.5 text-left transition-colors"
                        >
                          <Avatar className="size-9 shrink-0">
                            <AvatarFallback className="text-xs">
                              {initials(conv.customerFullName || conv.customerUsername || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {conv.customerUsername}
                              </span>
                              <span className="text-muted-foreground shrink-0 text-[11px]">
                                {conv.lastMessageAt
                                  ? formatDistanceToNow(new Date(conv.lastMessageAt), {
                                      addSuffix: true,
                                    })
                                  : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <p
                                className={cn(
                                  'truncate text-xs',
                                  conv.unreadCount > 0
                                    ? 'text-foreground font-medium'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {conv.lastMessagePreview || 'No messages yet.'}
                              </p>
                              {conv.unreadCount > 0 && (
                                <span className="bg-primary text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="flex-1 space-y-3 overflow-y-auto p-3" ref={scrollRef}>
                    {messages.length === 0 ? (
                      <div className="text-muted-foreground mt-10 text-center text-sm">
                        Send a message to start the conversation.
                      </div>
                    ) : (
                      messages.map((msg) => <CustomerBubble key={msg.id} message={msg} />)
                    )}
                  </div>

                  <MessageComposer
                    uploadUrl="/api/messages/attachments"
                    sending={sending}
                    onSend={async (body, attachments) => {
                      setSending(true);
                      const result = await sendMessage(
                        activeCustomer.customerId,
                        body,
                        attachments,
                      );
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
                </div>
              )
            ) : !teamTargetId ? (
              <ScrollArea className="h-full">
                <div className="space-y-0.5 p-2">
                  {teamConversations.length === 0 && startableContacts.length === 0 ? (
                    <div className="text-muted-foreground p-8 text-center text-sm">
                      No one to message yet.
                    </div>
                  ) : (
                    <>
                      {teamConversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setActiveThread(conv)}
                          className="hover:bg-accent flex w-full items-start gap-2.5 rounded-md p-2.5 text-left transition-colors"
                        >
                          <Avatar className="size-9 shrink-0">
                            <AvatarFallback className="text-xs">
                              {initials(conv.counterpartFullName || conv.counterpartUsername)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {conv.counterpartUsername}
                              </span>
                              <span className="text-muted-foreground shrink-0 text-[11px]">
                                {conv.lastMessageAt
                                  ? formatDistanceToNow(new Date(conv.lastMessageAt), {
                                      addSuffix: true,
                                    })
                                  : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <p
                                className={cn(
                                  'truncate text-xs',
                                  conv.unreadCount > 0
                                    ? 'text-foreground font-medium'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {conv.lastMessagePreview || 'No messages yet.'}
                              </p>
                              {conv.unreadCount > 0 && (
                                <span className="bg-primary text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}

                      {startableContacts.length > 0 ? (
                        <>
                          <div className="text-muted-foreground px-2.5 pt-2 pb-1 text-[11px] font-medium">
                            Start a conversation
                          </div>
                          {startableContacts.map((contact) => (
                            <button
                              key={contact.id}
                              onClick={() => setActiveContact(contact)}
                              className="hover:bg-accent flex w-full items-center gap-2.5 rounded-md p-2.5 text-left transition-colors"
                            >
                              <Avatar className="size-9 shrink-0">
                                <AvatarFallback className="text-xs">
                                  {initials(contact.fullName || contact.username)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-sm font-medium">
                                {contact.username}
                              </span>
                            </button>
                          ))}
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-3" ref={scrollRef}>
                  {teamMessages.length === 0 ? (
                    <div className="text-muted-foreground mt-10 text-center text-sm">
                      Send a message to start the conversation.
                    </div>
                  ) : (
                    teamMessages.map((msg) => (
                      <TeamBubble
                        key={msg.id}
                        message={msg}
                        fromSelf={msg.senderStaffId === actorId}
                      />
                    ))
                  )}
                </div>

                <MessageComposer
                  uploadUrl="/api/messages/attachments"
                  sending={teamSending}
                  onSend={async (body, attachments) => {
                    setTeamSending(true);
                    const result = await sendStaffMessage(teamTargetId, body, attachments);
                    setTeamSending(false);

                    if (result.ok && result.data) {
                      setTeamMessages((current) =>
                        current.some((existing) => existing.id === result.data!.id)
                          ? current
                          : [...current, result.data!],
                      );
                      if (!activeThread) refreshTeam();
                      return true;
                    }
                    return false;
                  }}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      <Button
        size="icon"
        className={cn(
          'size-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95',
          isOpen
            ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
            : 'bg-primary text-primary-foreground',
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <XIcon className="size-6" />
        ) : (
          <div className="relative">
            <MessageSquareIcon className="size-6" />
            {unreadCount > 0 && (
              <span className="animate-in zoom-in absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        )}
      </Button>
    </div>
  );
}

function CustomerBubble({ message }: { message: Message }) {
  const isCustomer = message.senderType === 'customer';
  const hasAttachments = Boolean(message.attachments?.length);
  const hasBody = message.body.trim().length > 0;

  return (
    <div className={cn('flex', isCustomer ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'w-max max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2 text-sm shadow-sm',
          isCustomer
            ? 'bg-background rounded-bl-sm'
            : 'bg-primary text-primary-foreground rounded-br-sm',
        )}
      >
        {hasBody ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
        {hasAttachments ? (
          <MessageAttachments attachments={message.attachments!} fromSelf={!isCustomer} />
        ) : null}
        <p
          className={cn(
            'text-[10px] opacity-70',
            isCustomer ? 'text-left' : 'text-primary-foreground text-right',
          )}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

function TeamBubble({ message, fromSelf }: { message: StaffMessage; fromSelf: boolean }) {
  const hasAttachments = Boolean(message.attachments?.length);
  const hasBody = message.body.trim().length > 0;

  return (
    <div className={cn('flex', fromSelf ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'w-max max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2 text-sm shadow-sm',
          fromSelf
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-background rounded-bl-sm',
        )}
      >
        {hasBody ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
        {hasAttachments ? (
          <MessageAttachments attachments={message.attachments!} fromSelf={fromSelf} />
        ) : null}
        <p
          className={cn(
            'text-[10px] opacity-70',
            fromSelf ? 'text-primary-foreground text-right' : 'text-left',
          )}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

/** A one-glyph version of the full page's connection badge — there's no room for the label here. */
function ConnectionDot({ state }: { state: 'connecting' | 'live' | 'offline' }) {
  if (state === 'live') {
    return <RadioIcon className="ml-1 size-3 text-green-300" aria-label="Live" />;
  }
  if (state === 'connecting') {
    return <span className="sr-only">Connecting…</span>;
  }
  return (
    <WifiOffIcon
      className="text-primary-foreground/70 ml-1 size-3"
      aria-label="Not live — new messages will not appear until you refresh"
    />
  );
}
