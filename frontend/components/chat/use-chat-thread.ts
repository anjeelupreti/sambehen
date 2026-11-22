'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatMessage, ThreadPage } from './types';
import type { MessageAttachment } from '@/lib/types';

export interface ThreadAdapter {
  /** Changes when a different conversation is opened; null means none. */
  key: string | null;
  load: (before?: string) => Promise<ThreadPage>;
  send: (body: string, attachments: MessageAttachment[]) => Promise<ChatMessage | null>;
}

/**
 * The state behind one open conversation, the same for every surface:
 * history paged in from the top, sends that appear at once and settle to
 * sent or failed, retries, and the other side's read position.
 */
export function useChatThread(adapter: ThreadAdapter) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setReadAt(null);
    setCursor(null);
    if (!adapter.key) return;

    setLoading(true);
    adapterRef.current
      .load()
      .then((page) => {
        if (cancelled) return;
        setMessages(page.messages);
        setReadAt(page.readAt);
        setCursor(page.nextCursor);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [adapter.key]);

  const loadOlder = useCallback(async () => {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await adapterRef.current.load(cursor);
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id));
        return [...page.messages.filter((m) => !known.has(m.id)), ...current];
      });
      setCursor(page.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }, [cursor, loadingOlder]);

  /** A message that arrived over the socket. Ignores ones already shown. */
  const receive = useCallback((message: ChatMessage) => {
    setMessages((current) =>
      current.some((m) => m.id === message.id) ? current : [...current, message],
    );
  }, []);

  const deliver = useCallback(async (temp: ChatMessage) => {
    const saved = await adapterRef.current.send(temp.body, temp.attachments).catch(() => null);
    setMessages((current) => {
      if (!saved) return current.map((m) => (m.id === temp.id ? { ...m, status: 'failed' } : m));
      // The socket may already have delivered the saved copy.
      const withoutTemp = current.filter((m) => m.id !== temp.id);
      return withoutTemp.some((m) => m.id === saved.id)
        ? withoutTemp
        : current.map((m) => (m.id === temp.id ? saved : m));
    });
  }, []);

  const send = useCallback(
    (body: string, attachments: MessageAttachment[]) => {
      const temp: ChatMessage = {
        id: `pending-${crypto.randomUUID()}`,
        body,
        attachments,
        createdAt: new Date().toISOString(),
        mine: true,
        status: 'sending',
      };
      setMessages((current) => [...current, temp]);
      void deliver(temp);
    },
    [deliver],
  );

  const retry = useCallback(
    (message: ChatMessage) => {
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id
            ? { ...m, status: 'sending', createdAt: new Date().toISOString() }
            : m,
        ),
      );
      void deliver({ ...message, status: 'sending' });
    },
    [deliver],
  );

  return {
    messages,
    readAt,
    setReadAt,
    hasMore: Boolean(cursor),
    loading,
    loadingOlder,
    loadOlder,
    receive,
    send,
    retry,
  };
}
