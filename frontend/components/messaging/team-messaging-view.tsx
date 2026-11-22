'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  listStaffContacts,
  listStaffConversations,
  loadStaffThread,
  markStaffConversationRead,
  sendStaffReply,
} from '@/app/(app)/messages/staff-actions';
import { ConversationList, type ConversationRow } from '@/components/chat/conversation-list';
import { fromStaffThread } from '@/components/chat/mappers';
import { ChatPane } from '@/components/chat/pane';
import { useChatSocket, useSocketEvent } from '@/components/chat/socket';
import { useChatThread } from '@/components/chat/use-chat-thread';
import { useTypingMap } from '@/components/chat/use-typing-map';
import { NoConversation, previewOf } from '@/components/messaging/messaging-view';
import type { StaffContact, StaffConversation, StaffMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<string, string> = { master: 'Master', manager: 'Manager', store: 'Store' };

interface Person {
  id: string;
  name: string;
  role: string;
}

/**
 * Staff-to-staff chats. Colleagues the server says the caller may reach are
 * listed after the existing chats, so starting one is just opening it:
 * the thread becomes real with the first message.
 *
 * Everything is keyed on the colleague's id rather than the conversation
 * id, so the first send doesn't reload the thread it just created.
 */
export function TeamMessagingView({
  viewer,
  compact,
  onUnreadChange,
}: {
  viewer: { id: string; username: string };
  compact?: boolean;
  onUnreadChange?: (unread: number) => void;
}) {
  const { state, emit, presence, requestPresence } = useChatSocket();
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const typing = useTypingMap();

  const refresh = useCallback(() => listStaffConversations().then(setConversations), []);

  useEffect(() => {
    void refresh();
    void listStaffContacts().then(setContacts);
  }, [refresh]);

  useEffect(() => {
    onUnreadChange?.(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
  }, [conversations, onUnreadChange]);

  const conversationByPerson = useMemo(
    () => new Map(conversations.map((c) => [c.counterpartId, c])),
    [conversations],
  );
  const selectedConversation = selectedId ? conversationByPerson.get(selectedId) : undefined;
  const conversationRef = useRef(selectedConversation);
  conversationRef.current = selectedConversation;

  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const c of conversations) {
      map.set(c.counterpartId, {
        id: c.counterpartId,
        name: c.counterpartFullName || c.counterpartUsername,
        role: c.counterpartRole,
      });
    }
    for (const c of contacts) {
      if (!map.has(c.id)) map.set(c.id, { id: c.id, name: c.fullName || c.username, role: c.role });
    }
    return map;
  }, [conversations, contacts]);
  const selectedPerson = selectedId ? people.get(selectedId) : undefined;

  const staffIds = useMemo(() => [...people.keys()].join(','), [people]);
  useEffect(() => {
    if (state === 'live' && staffIds) requestPresence({ staffIds: staffIds.split(',') });
  }, [state, staffIds, requestPresence]);

  const thread = useChatThread({
    key: selectedId,
    load: async (before) => {
      const conversation = conversationRef.current;
      if (!conversation) return { messages: [], nextCursor: null, readAt: null };
      return loadStaffThread(conversation.id, before);
    },
    send: async (body, attachments) => {
      const result = await sendStaffReply(selectedId!, body, attachments);
      if (!result) return null;
      if (!conversationRef.current) void refresh();
      return result.message;
    },
  });

  useSocketEvent<StaffMessage>('staffmessage:new', (message) => {
    const conversation = conversations.find((c) => c.id === message.conversationId);
    if (!conversation) {
      void refresh();
      return;
    }
    const mine = message.senderStaffId === viewer.id;
    const open = conversation.counterpartId === selectedId;
    setConversations((current) =>
      [...current]
        .map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                lastMessagePreview: previewOf(message),
                lastMessageAt: message.createdAt,
                messageCount: c.messageCount + 1,
                unreadCount: open || mine ? c.unreadCount : c.unreadCount + 1,
              }
            : c,
        )
        .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')),
    );
    if (open) {
      thread.receive(fromStaffThread(message, viewer.id));
      if (!mine) void markStaffConversationRead(message.conversationId);
    }
    if (!mine) typing.set(message.senderStaffId, false);
  });

  useSocketEvent<{ staffId: string; isTyping: boolean }>('staff:typing', ({ staffId, isTyping }) =>
    typing.set(staffId, isTyping),
  );

  useSocketEvent<{ conversationId: string; readAt: string }>('staffconversation:read', (event) => {
    if (event.conversationId === selectedConversation?.id) thread.setReadAt(event.readAt);
  });

  const open = useCallback(
    (personId: string) => {
      setSelectedId(personId);
      const conversation = conversationByPerson.get(personId);
      if (conversation && conversation.unreadCount > 0) {
        setConversations((current) =>
          current.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c)),
        );
        void markStaffConversationRead(conversation.id);
      }
    },
    [conversationByPerson],
  );

  const rows: ConversationRow[] = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (person: Person) =>
      !query ||
      person.name.toLowerCase().includes(query) ||
      person.role.toLowerCase().includes(query);
    const chats = conversations
      .map((c) => ({ c, person: people.get(c.counterpartId)! }))
      .filter(({ person }) => matches(person))
      .map(({ c, person }) => ({
        id: person.id,
        name: person.name,
        preview: c.lastMessagePreview,
        time: c.lastMessageAt,
        unread: c.unreadCount,
        online: presence[`staff:${person.id}`]?.online,
        typing: typing.isTyping(person.id),
      }));
    const others = [...people.values()]
      .filter((person) => !conversationByPerson.has(person.id) && matches(person))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((person) => ({
        id: person.id,
        name: person.name,
        preview: ROLE_LABEL[person.role] ?? person.role,
        time: null,
        unread: 0,
        online: presence[`staff:${person.id}`]?.online,
      }));
    return [...chats, ...others];
  }, [conversations, conversationByPerson, people, search, presence, typing]);

  const pane = selectedPerson ? (
    <ChatPane
      title={selectedPerson.name}
      subtitle={ROLE_LABEL[selectedPerson.role] ?? selectedPerson.role}
      presence={presence[`staff:${selectedPerson.id}`]}
      typing={typing.isTyping(selectedPerson.id)}
      thread={thread}
      uploadUrl="/api/messages/attachments"
      onTyping={(isTyping) => {
        if (selectedConversation)
          emit('staff:typing', { conversationId: selectedConversation.id, isTyping });
      }}
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
      searchPlaceholder="Search colleagues"
      empty={search ? 'No one matches that search.' : 'No colleagues to message yet.'}
    />
  );

  if (compact) return selectedPerson ? pane : list;

  return (
    <div className="bg-background grid h-full min-h-0 overflow-hidden md:grid-cols-[minmax(300px,360px)_1fr]">
      <aside
        className={cn('flex min-h-0 flex-col border-r', selectedPerson ? 'hidden md:flex' : 'flex')}
      >
        {list}
      </aside>
      <div className={cn('min-h-0 flex-col', selectedPerson ? 'flex' : 'hidden md:flex')}>
        {pane ?? <NoConversation />}
      </div>
    </div>
  );
}
