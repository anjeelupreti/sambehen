'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';

import { getSocketToken } from '@/app/(app)/messages/actions';
import { getCustomerSocketToken } from '@/app/customer/(portal)/messages/actions';

export type SocketState = 'connecting' | 'live' | 'offline';

export interface Presence {
  online: boolean;
  lastSeenAt: string | null;
}

type Handler = (payload: never) => void;

interface ChatSocketValue {
  state: SocketState;
  /** Subscribe to a server event; returns the unsubscribe. */
  on: (event: string, handler: (payload: never) => void) => () => void;
  emit: (event: string, payload: unknown) => void;
  /** Presence by key: `customer:<id>` or `staff:<id>`. */
  presence: Record<string, Presence>;
  /** For a customer: whether anyone on their team is online. */
  teamOnline: boolean;
  /** Ask for presence of the people about to be shown. */
  requestPresence: (ids: { customerIds?: string[]; staffIds?: string[] }) => void;
}

const ChatSocketContext = createContext<ChatSocketValue | null>(null);

/**
 * One messaging socket per tab, shared by every chat surface on the page —
 * the inbox, the floating bubble, the player thread. Each surface used to
 * open its own; with presence counted per connection, one shared socket is
 * also what keeps "online" honest.
 *
 * The token comes from a server action: the access token lives in an
 * httpOnly cookie, and the socket handshake is the one place the browser
 * has to hold it.
 */
export function ChatSocketProvider({
  realm,
  children,
}: {
  realm: 'staff' | 'customer';
  children: ReactNode;
}) {
  const [state, setState] = useState<SocketState>('connecting');
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [teamOnline, setTeamOnline] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlers = useRef(new Map<string, Set<Handler>>());

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    const connect = async () => {
      const token = realm === 'staff' ? await getSocketToken() : await getCustomerSocketToken();
      if (cancelled) return;
      if (!token) {
        setState('offline');
        return;
      }

      const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
      socket = io(`${url}/ws/messaging`, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on('connected', () => setState('live'));
      socket.on('disconnect', () => setState('offline'));
      socket.on('connect_error', () => setState('offline'));
      socket.on('auth:error', () => {
        setState('offline');
        socket?.disconnect();
      });

      socket.on('presence', (update: { kind: 'customer' | 'staff'; id: string } & Presence) =>
        setPresence((current) => ({
          ...current,
          [`${update.kind}:${update.id}`]: { online: update.online, lastSeenAt: update.lastSeenAt },
        })),
      );
      socket.on('team:presence', (update: { online: boolean }) => setTeamOnline(update.online));

      // Fan every other event out to whoever subscribed to it.
      socket.onAny((event: string, payload: unknown) => {
        for (const handler of handlers.current.get(event) ?? []) {
          (handler as (value: unknown) => void)(payload);
        }
      });
    };

    void connect();
    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [realm]);

  const on = useCallback((event: string, handler: Handler) => {
    const set = handlers.current.get(event) ?? new Set<Handler>();
    set.add(handler);
    handlers.current.set(event, set);
    return () => {
      set.delete(handler);
    };
  }, []);

  const emit = useCallback((event: string, payload: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const requestPresence = useCallback(
    (ids: { customerIds?: string[]; staffIds?: string[] }) => {
      const socket = socketRef.current;
      if (!socket || state !== 'live') return;
      socket.emit(
        'presence:query',
        ids,
        (answer: {
          customers?: Record<string, Presence>;
          staff?: Record<string, Presence>;
          team?: { online: boolean };
        }) => {
          if (answer.team) setTeamOnline(answer.team.online);
          setPresence((current) => {
            const next = { ...current };
            for (const [id, value] of Object.entries(answer.customers ?? {}))
              next[`customer:${id}`] = value;
            for (const [id, value] of Object.entries(answer.staff ?? {}))
              next[`staff:${id}`] = value;
            return next;
          });
        },
      );
    },
    [state],
  );

  const value = useMemo(
    () => ({ state, on, emit, presence, teamOnline, requestPresence }),
    [state, on, emit, presence, teamOnline, requestPresence],
  );

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}

export function useChatSocket(): ChatSocketValue {
  const value = useContext(ChatSocketContext);
  if (!value) throw new Error('useChatSocket must be used inside ChatSocketProvider');
  return value;
}

/** Subscribe to one socket event for the lifetime of a component. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const { on } = useChatSocket();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => on(event, ((payload: T) => ref.current(payload)) as Handler), [on, event]);
}
