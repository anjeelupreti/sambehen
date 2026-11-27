'use client';

import { useState } from 'react';

import { useSocketEvent } from '@/components/chat/socket';
import type { components } from '@/lib/api-schema';

export type FeedWin = components['schemas']['WinFeedItemDto'];

/** The recent-wins list, with new ones added the moment staff record them. */
export function useLiveWins(initial: FeedWin[]) {
  const [wins, setWins] = useState(initial);
  useSocketEvent<Omit<FeedWin, 'mine'>>('win:new', (win) => {
    setWins((current) =>
      [{ ...win, mine: false }, ...current.filter((item) => item.id !== win.id)].slice(0, 30),
    );
  });
  return wins;
}
