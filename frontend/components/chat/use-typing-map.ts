'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** A typing signal that is never cleared (a dropped connection) expires after this. */
const TYPING_TTL_MS = 6000;

/**
 * Who is typing right now, by id. Each "started typing" signal expires on
 * its own, so a lost "stopped typing" can never leave "typing…" stuck.
 */
export function useTypingMap() {
  const [typing, setTyping] = useState<Record<string, true>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const set = useCallback((id: string, isTyping: boolean) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    if (isTyping) {
      timers.current.set(
        id,
        setTimeout(() => set(id, false), TYPING_TTL_MS),
      );
    } else {
      timers.current.delete(id);
    }
    setTyping((current) => {
      if (Boolean(current[id]) === isTyping) return current;
      const next = { ...current };
      if (isTyping) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);

  return useMemo(() => ({ set, isTyping: (id: string) => Boolean(typing[id]) }), [set, typing]);
}
