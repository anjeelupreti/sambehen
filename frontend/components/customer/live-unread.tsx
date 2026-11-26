'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { useSocketEvent } from '@/components/chat/socket';
import { formatCount } from '@/lib/money';

const UnreadContext = createContext(0);

/**
 * The player's unread count, kept live. The server's count seeds it on
 * each page load; after that the chat connection raises it the moment the
 * team replies, and it drops to zero while the player is in the thread
 * (which marks everything read). Before this, the count only changed on a
 * full page load, so new replies never lit the tab.
 */
export function LiveUnreadProvider({
  initial,
  children,
}: {
  initial: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const inThread = pathname.startsWith('/customer/messages');
  const [count, setCount] = useState(initial);

  // A fresh server count (navigation or router.refresh) wins.
  useEffect(() => setCount(initial), [initial]);
  useEffect(() => {
    if (inThread) setCount(0);
  }, [inThread]);

  useSocketEvent<{ senderType?: string }>('message:new', (message) => {
    if (message.senderType === 'customer' || inThread) return;
    setCount((current) => current + 1);
  });

  return <UnreadContext.Provider value={inThread ? 0 : count}>{children}</UnreadContext.Provider>;
}

export function useLiveUnread() {
  return useContext(UnreadContext);
}

/** The "N new" pill on the overview's messages card. */
export function LiveUnreadPill() {
  const count = useLiveUnread();
  if (count <= 0) return null;
  return (
    <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
      {formatCount(count)} new
    </span>
  );
}
