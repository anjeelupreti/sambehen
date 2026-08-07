'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  Maximize2Icon,
  MessageSquareIcon,
  RadioIcon,
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
import { useMessagingSocket, type LiveMessage } from '@/hooks/use-messaging-socket';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/lib/types';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

/**
 * The chat bubble. Same inbox and threads as the full `/messages` page —
 * this is the compact surface for staying on top of things without leaving
 * whatever page you're on, with a link out to the full page for anyone who
 * wants more room. Shares MessageComposer with the full page, so an
 * attachment sent from either surface behaves identically.
 *
 * Arrivals come over the socket, not a poll: `useMessagingSocket` is the
 * same hook the full page uses, so a message shows up here the instant it
 * shows up there. The 30s fetch is a fallback for while the socket is
 * reconnecting, not the primary path — it stands down once the connection
 * is live.
 */
export function MessagesFab({ role: _role }: { role: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeCustomer?.id ?? null;
  }, [activeCustomer]);

  const refresh = useCallback(() => {
    getConversations()
      .then(setConversations)
      .catch(() => {});
  }, []);

  // Seeds the list once on mount — the socket only reports what arrives
  // *after* it connects, not what was already unread.
  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const { state } = useMessagingSocket(handleIncoming);

  // Fallback only: while the socket is not live, nothing pushes updates, so
  // this covers reconnect gaps. Once `state === 'live'` the socket is the
  // only source — polling on top of it would just re-sort the list under
  // someone mid-read for no reason.
  useEffect(() => {
    if (state === 'live') return;
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [state, refresh]);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const unreadCount = conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end">
      {isOpen && (
        <Card className="animate-in slide-in-from-bottom-5 mb-4 flex h-[560px] w-[360px] flex-col overflow-hidden border-none py-0 shadow-2xl sm:w-[400px]">
          <div className="bg-primary text-primary-foreground flex shrink-0 items-center justify-between px-3 py-3">
            {activeCustomer ? (
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-primary-foreground/15 size-8 shrink-0 text-current"
                  onClick={() => setActiveCustomer(null)}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback className="bg-primary-foreground/15 text-primary-foreground text-[11px]">
                    {initials(
                      activeCustomer.customerFullName || activeCustomer.customerUsername || '?',
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">{activeCustomer.customerUsername}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-1 font-semibold">
                <MessageSquareIcon className="size-4" />
                Inbox
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
            {!activeCustomer ? (
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
                    messages.map((msg) => <Bubble key={msg.id} message={msg} />)
                  )}
                </div>

                <MessageComposer
                  uploadUrl="/api/messages/attachments"
                  sending={sending}
                  onSend={async (body, attachments) => {
                    setSending(true);
                    const result = await sendMessage(activeCustomer.customerId, body, attachments);
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

function Bubble({ message }: { message: Message }) {
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

/** A one-glyph version of the full page's connection badge — there's no room for the label here. */
function ConnectionDot({ state }: { state: 'connecting' | 'live' | 'offline' }) {
  if (state === 'live') {
    return <RadioIcon className="size-3 text-green-300" aria-label="Live" />;
  }
  if (state === 'connecting') {
    return <span className="sr-only">Connecting…</span>;
  }
  return (
    <WifiOffIcon
      className="text-primary-foreground/70 size-3"
      aria-label="Not live — new messages will not appear until you refresh"
    />
  );
}
