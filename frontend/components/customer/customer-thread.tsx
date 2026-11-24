'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { loadMyThread, markMyThreadRead, sendMine } from '@/app/customer/(portal)/messages/actions';
import { fromCustomerThreadForCustomer } from '@/components/chat/mappers';
import { ChatPane } from '@/components/chat/pane';
import { useChatSocket, useSocketEvent } from '@/components/chat/socket';
import { useChatThread } from '@/components/chat/use-chat-thread';
import { useTypingMap } from '@/components/chat/use-typing-map';
import type { Message } from '@/lib/types';

/**
 * The player's one thread with their team. The team speaks with one
 * voice: the gateway strips which staff member replied, and "online"
 * means someone in the player's chain is connected.
 */
export function CustomerThread() {
  const { state, emit, teamOnline, requestPresence } = useChatSocket();
  const typing = useTypingMap();

  const thread = useChatThread({
    key: 'me',
    load: (before) => loadMyThread(before),
    send: (body, attachments) => sendMine(body, attachments),
  });

  const router = useRouter();
  useEffect(() => {
    // Refresh once read, so the tab bar's unread badge clears.
    void markMyThreadRead().then(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (state === 'live') requestPresence({});
  }, [state, requestPresence]);

  useSocketEvent<Message>('message:new', (message) => {
    thread.receive(fromCustomerThreadForCustomer(message));
    if (message.senderType !== 'customer') {
      typing.set('team', false);
      if (document.visibilityState === 'visible') void markMyThreadRead();
    }
  });

  useSocketEvent<{ isTyping: boolean }>('typing', ({ isTyping }) => typing.set('team', isTyping));

  useSocketEvent<{ by: string; readAt: string }>('conversation:read', (event) => {
    if (event.by === 'team') thread.setReadAt(event.readAt);
  });

  // Messages that arrived while the tab was in the background count as
  // read once the player comes back to it.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void markMyThreadRead();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <ChatPane
      title="Your team"
      presence={{ online: teamOnline, lastSeenAt: null }}
      typing={typing.isTyping('team')}
      thread={thread}
      uploadUrl="/customer/messages/attachments"
      onTyping={(isTyping) => emit('typing', { isTyping })}
    />
  );
}
