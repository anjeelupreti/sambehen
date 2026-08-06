'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  Maximize2Icon,
  MessageSquareIcon,
  RadioIcon,
  SendIcon,
  UserIcon,
  WifiOffIcon,
  XIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

/**
 * The chat bubble. Same inbox and threads as the full `/messages` page —
 * this is the compact surface for staying on top of things without leaving
 * whatever page you're on, with a link out to the full page for anyone who
 * wants filters or more room.
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
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeCustomer) return;

    try {
      setIsSending(true);
      const result = await sendMessage(activeCustomer.customerId, newMessage.trim());

      if (result.ok && result.data) {
        setMessages((prev) =>
          prev.some((m) => m.id === result.data!.id) ? prev : [...prev, result.data as Message],
        );
        setNewMessage('');
      } else if (!result.ok) {
        console.error('Failed to send message', result.message);
      }
    } catch (error) {
      console.error('Failed to send message', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <Card className="mb-4 w-[350px] sm:w-[400px] h-[500px] shadow-2xl flex flex-col overflow-hidden border-border/50 animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-3 flex items-center justify-between shadow-sm">
            {activeCustomer ? (
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-primary-foreground hover:bg-primary/90 hover:text-white"
                  onClick={() => setActiveCustomer(null)}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <div className="font-semibold truncate">{activeCustomer.customerUsername}</div>
              </div>
            ) : (
              <div className="font-semibold flex items-center gap-2 pl-2">
                <MessageSquareIcon className="size-4" />
                Inbox
                <ConnectionDot state={state} />
              </div>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-8 text-primary-foreground hover:bg-primary/90 hover:text-white"
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
                className="size-8 text-primary-foreground hover:bg-primary/90 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-muted/20 relative">
            {!activeCustomer ? (
              // Inbox List
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {conversations.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No active conversations.
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setActiveCustomer(conv)}
                        className="w-full flex items-start gap-3 p-3 text-left hover:bg-accent rounded-md transition-colors"
                      >
                        <div className="bg-primary/10 rounded-full p-2 shrink-0 relative">
                          <UserIcon className="size-4 text-primary" />
                          {conv.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full size-4 flex items-center justify-center">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="font-medium text-sm truncate">
                              {conv.customerUsername}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {conv.lastMessageAt
                                ? formatDistanceToNow(new Date(conv.lastMessageAt), {
                                    addSuffix: true,
                                  })
                                : ''}
                            </span>
                          </div>
                          <p
                            className={cn(
                              'text-xs truncate',
                              conv.unreadCount > 0
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground',
                            )}
                          >
                            {conv.lastMessagePreview || 'No messages yet.'}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            ) : (
              // Chat Thread
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm mt-10">
                      Send a message to start the conversation.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isCustomer = msg.senderType === 'customer';
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex w-max max-w-[80%] flex-col gap-1 rounded-xl px-4 py-2 text-sm',
                            isCustomer
                              ? 'bg-muted self-start rounded-tl-sm'
                              : 'bg-primary text-primary-foreground self-end rounded-tr-sm',
                          )}
                        >
                          <span>{msg.body}</span>
                          <span
                            className={cn(
                              'text-[10px] opacity-70',
                              isCustomer
                                ? 'text-muted-foreground text-left'
                                : 'text-primary-foreground text-right',
                            )}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-3 bg-background border-t">
                  <form onSubmit={handleSend} className="flex items-center gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      disabled={isSending}
                    />
                    <Button type="submit" size="icon" disabled={!newMessage.trim() || isSending}>
                      <SendIcon className="size-4" />
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Trigger FAB */}
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
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full size-5 flex items-center justify-center animate-in zoom-in">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        )}
      </Button>
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
      className="size-3 text-primary-foreground/70"
      aria-label="Not live — new messages will not appear until you refresh"
    />
  );
}
