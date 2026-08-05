'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquareIcon, XIcon, SendIcon, UserIcon, ArrowLeftIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/lib/types';

export function MessagesFab({ role: _role }: { role: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch conversations (inbox)
  useEffect(() => {
    if (isOpen && !activeCustomer) {
      getConversations()
        .then((data) => {
          setConversations(data);
          setUnreadCount(data.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0));
        })
        .catch(console.error);
    }
  }, [isOpen, activeCustomer]);

  // Periodically fetch unread counts even if closed (every 30s)
  useEffect(() => {
    const fetchUnread = () => {
      getConversations()
        .then((data) => {
          setUnreadCount(data.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0));
          if (isOpen && !activeCustomer) setConversations(data);
        })
        .catch(() => {});
    };
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [isOpen, activeCustomer]);

  // Fetch messages for a specific conversation
  useEffect(() => {
    if (activeCustomer) {
      // Keyed on the conversation id: the messages and read endpoints take
      // a conversation, not a customer. Passing the customer id returns
      // nothing and reads as an empty thread.
      getMessages(activeCustomer.id)
        .then((thread) => {
          // Already oldest-first: the action reverses the API's newest-first
          // order once, so reversing again here would flip it back.
          setMessages(thread);

          if (activeCustomer.unreadCount > 0) {
            void markAsRead(activeCustomer.id);
            setUnreadCount((prev) => Math.max(0, prev - activeCustomer.unreadCount));
          }
        })
        .catch(console.error);
    }
  }, [activeCustomer]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeCustomer) return;

    try {
      setIsSending(true);
      // Sending is keyed on the customer — it creates the thread on first
      // contact. The action returns a result envelope, not the message, so
      // a failure keeps the typed text instead of clearing the box.
      const result = await sendMessage(activeCustomer.customerId, newMessage.trim());

      if (result.ok && result.data) {
        setMessages((prev) => [...prev, result.data as Message]);
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
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-primary-foreground hover:bg-primary/90 hover:text-white"
                  onClick={() => setActiveCustomer(null)}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <div className="font-semibold">{activeCustomer.customerUsername}</div>
              </div>
            ) : (
              <div className="font-semibold flex items-center gap-2 pl-2">
                <MessageSquareIcon className="size-4" />
                Inbox
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-primary-foreground hover:bg-primary/90 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <XIcon className="size-4" />
            </Button>
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
                        key={conv.customerId}
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
