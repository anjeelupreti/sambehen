'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessagesSquareIcon } from 'lucide-react';

import {
  listConversations,
  loadThread,
  markConversationRead,
  sendReply,
} from '@/app/(app)/messages/actions';
import { ConversationList, type ConversationRow } from '@/components/chat/conversation-list';
import { fromCustomerThreadForStaff } from '@/components/chat/mappers';
import { ChatPane } from '@/components/chat/pane';
import { useChatSocket, useSocketEvent } from '@/components/chat/socket';
import { useChatThread } from '@/components/chat/use-chat-thread';
import { useTypingMap } from '@/components/chat/use-typing-map';
import type { Conversation, Message } from '@/lib/types';
import { cn } from '@/lib/utils';

type LiveMessage = Message & { conversationId: string; customerId: string };

/**
 * Staff conversations with customers: the list and the open thread side by
 * side on desktop, one at a time on a phone. `compact` is the single-pane
 * version the floating chat uses.
 */
export function MessagingView({
  initialConversations,
  viewer,
  compact,
  onUnreadChange,
}: {
  initialConversations?: Conversation[];
  viewer: { id: string; username: string };
  compact?: boolean;
  onUnreadChange?: (unread: number) => void;
}) {
  const { state, emit, presence, requestPresence } = useChatSocket();
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations ?? []);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const typing = useTypingMap();

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!initialConversations) void listConversations().then(setConversations);
  }, [initialConversations]);

  useEffect(() => {
    onUnreadChange?.(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
  }, [conversations, onUnreadChange]);

  // Presence for everyone in the list, once the socket is up.
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
    const known = conversations.some((c) => c.id === message.conversationId);
    if (!known) {
      void listConversations().then(setConversations);
      return;
    }
    const open = message.conversationId === selectedId;
    setConversations((current) =>
      sortByRecent(
        current.map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                lastMessagePreview: previewOf(message),
                lastMessageAt: message.createdAt,
                messageCount: c.messageCount + 1,
                unreadCount:
                  open || message.senderType === 'staff' ? c.unreadCount : c.unreadCount + 1,
                awaitingReply: message.senderType === 'customer',
              }
            : c,
        ),
      ),
    );
    if (open) {
      thread.receive(fromCustomerThreadForStaff(message, viewer.username));
      if (message.senderType === 'customer') void markConversationRead(message.conversationId);
    }
    if (message.senderType === 'customer') typing.set(message.customerId, false);
  });

  useSocketEvent<{ customerId: string; isTyping: boolean }>('typing', ({ customerId, isTyping }) =>
    typing.set(customerId, isTyping),
  );

  useSocketEvent<{ conversationId: string; readAt: string }>('conversation:read', (event) => {
    if (event.conversationId === selectedId) thread.setReadAt(event.readAt);
  });

  const open = useCallback((id: string) => {
    setSelectedId(id);
    setConversations((current) => current.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }, []);

  const rows: ConversationRow[] = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations
      .filter(
        (c) =>
          !query ||
          c.customerFullName?.toLowerCase().includes(query) ||
          c.customerUsername?.toLowerCase().includes(query) ||
          c.lastMessagePreview?.toLowerCase().includes(query),
      )
      .map((c) => ({
        id: c.id,
        name: c.customerFullName || c.customerUsername || 'Customer',
        preview: c.lastMessagePreview,
        time: c.lastMessageAt,
        unread: c.unreadCount,
        awaitingReply: c.awaitingReply,
        online: presence[`customer:${c.customerId}`]?.online,
        typing: typing.isTyping(c.customerId),
      }));
  }, [conversations, search, presence, typing]);

  const pane = selected ? (
    <ChatPane
      title={selected.customerFullName || selected.customerUsername || 'Customer'}
      presence={presence[`customer:${selected.customerId}`]}
      typing={typing.isTyping(selected.customerId)}
      thread={thread}
      uploadUrl="/api/messages/attachments"
      onTyping={(isTyping) => emit('typing', { customerId: selected.customerId, isTyping })}
      onBack={() => setSelectedId(null)}
      compact={compact}
    />
  ) : null;

  const list = (
    <ConversationList
      rows={rows}
      selectedId={selectedId}
      onSelect={open}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search customers or messages"
      empty={search ? 'No one matches that search.' : 'No conversations yet.'}
    />
  );

  if (compact) return selected ? pane : list;

  return (
    <div className="bg-background grid h-full min-h-0 overflow-hidden md:grid-cols-[minmax(300px,360px)_1fr]">
      <aside className={cn('flex min-h-0 flex-col border-r', selected ? 'hidden md:flex' : 'flex')}>
        {list}
      </aside>
      <div className={cn('min-h-0 flex-col', selected ? 'flex' : 'hidden md:flex')}>
        {pane ?? <NoConversation />}
      </div>
    </div>
  );
}

export function NoConversation() {
  return (
    <div className="chat-wallpaper text-muted-foreground grid h-full place-items-center">
      <span className="flex flex-col items-center gap-3 text-sm">
        <MessagesSquareIcon className="size-10 opacity-40" aria-hidden />
        Select a conversation
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

function sortByRecent<T extends { lastMessageAt?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
}
