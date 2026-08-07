'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RadioIcon, WifiOffIcon } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';

import { getCustomerSocketToken, sendMyMessage } from '@/app/customer/(portal)/messages/actions';
import { MessageAttachments } from '@/components/messaging/message-attachments';
import { MessageComposer } from '@/components/messaging/message-composer';
import { formatDateTime } from '@/lib/money';
import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * The customer's single thread with the business.
 *
 * Live over the same gateway the staff app uses. The gateway fans out by
 * identity, so a customer socket joins one room — their own — and receives
 * exactly the messages on their own thread and nothing else.
 *
 * Staff attribution is stripped by the gateway before it reaches a
 * customer: they see that the business replied, not which member did.
 */
export function CustomerThread({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleIncoming = useCallback((message: Message) => {
    setMessages((current) =>
      // The sender receives their own message back over the socket; without
      // this the thread shows it twice.
      current.some((existing) => existing.id === message.id) ? current : [...current, message],
    );
  }, []);

  const handlerRef = useRef(handleIncoming);
  useEffect(() => {
    handlerRef.current = handleIncoming;
  }, [handleIncoming]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    const connect = async () => {
      const token = await getCustomerSocketToken();
      if (cancelled || !token) {
        setLive('offline');
        return;
      }

      const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
      socket = io(`${url}/ws/messaging`, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
      });

      socket.on('connected', () => setLive('live'));
      socket.on('disconnect', () => setLive('offline'));
      socket.on('connect_error', () => setLive('offline'));
      socket.on('auth:error', () => {
        setLive('offline');
        socket?.disconnect();
      });
      socket.on('message:new', (message: Message) => handlerRef.current(message));
    };

    void connect();

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-[calc(100svh-14rem)] flex-col overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">Messages with the team</span>
        {live === 'live' ? (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <RadioIcon className="size-3 text-green-600 dark:text-green-500" />
            Live
          </span>
        ) : live === 'connecting' ? (
          <span className="text-muted-foreground text-xs">Connecting…</span>
        ) : (
          <span
            className="text-muted-foreground flex items-center gap-1 text-xs"
            title="New messages will not appear until you refresh."
          >
            <WifiOffIcon className="size-3" />
            Not live
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No messages yet. Send one and the team will reply here.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderType === 'customer';
            const hasBody = message.body.trim().length > 0;
            const hasAttachments = Boolean(message.attachments?.length);

            return (
              <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] space-y-1.5 rounded-lg px-3 py-2',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {hasBody ? <p className="text-sm whitespace-pre-wrap">{message.body}</p> : null}
                  {hasAttachments ? (
                    <MessageAttachments attachments={message.attachments!} fromSelf={mine} />
                  ) : null}
                  <p
                    className={cn(
                      'text-[10px]',
                      mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {mine ? 'You' : 'Team'} · {formatDateTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        uploadUrl="/customer/messages/attachments"
        placeholder="Write a message…"
        sending={sending}
        onSend={async (body, attachments) => {
          setSending(true);
          const result = await sendMyMessage(body, attachments);
          setSending(false);

          if (result.ok && result.data) {
            handleIncoming(result.data);
            return true;
          }
          return false;
        }}
      />
    </div>
  );
}
