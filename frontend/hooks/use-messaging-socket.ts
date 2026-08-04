'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { getSocketToken } from '@/app/(app)/messages/actions';
import type { Message } from '@/lib/types';

/**
 * A live message carries the conversation and customer it belongs to, which
 * the REST shape does not — the gateway adds them so a listener can route
 * an arrival without a second lookup.
 */
export interface LiveMessage extends Message {
  customerId?: string;
}

export type SocketState = 'connecting' | 'live' | 'offline';

/**
 * Connects to the messaging gateway.
 *
 * The gateway fans out by *identity*, not by conversation: a socket joins
 * the rooms for who you are, so every message you are entitled to see
 * arrives on one connection regardless of how many threads exist. Nothing
 * here subscribes per conversation, and it should not start to.
 *
 * The connection state is surfaced rather than hidden. A page that claims
 * to be live while the socket is down is worse than one that admits it —
 * the reader would otherwise take an empty thread as "no new messages".
 */
export function useMessagingSocket(onMessage: (message: LiveMessage) => void) {
  const [state, setState] = useState<SocketState>('connecting');
  const socketRef = useRef<Socket | null>(null);

  // Kept in a ref so a re-rendered handler does not tear down the socket.
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    const connect = async () => {
      const token = await getSocketToken();
      if (cancelled) return;

      if (!token) {
        setState('offline');
        return;
      }

      const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

      socket = io(`${url}/ws/messaging`, {
        // The gateway reads the handshake auth, not a header — a browser
        // cannot set headers on a WebSocket upgrade.
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connected', () => setState('live'));
      socket.on('disconnect', () => setState('offline'));
      socket.on('connect_error', () => setState('offline'));

      // An expired or rejected token is terminal: reconnecting with the
      // same credential would loop. The page keeps working over HTTP and
      // says it is not live.
      socket.on('auth:error', () => {
        setState('offline');
        socket?.disconnect();
      });

      socket.on('message:new', (message: LiveMessage) => handlerRef.current(message));
    };

    void connect();

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { state };
}
