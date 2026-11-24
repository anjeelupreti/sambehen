'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

type Role = 'master' | 'manager' | 'store' | 'player';

const ROLES: { key: Role; name: string; body: string; sees: string }[] = [
  {
    key: 'master',
    name: 'Master',
    body: 'Sets up managers and stores, approves new players, runs tiers, rewards and broadcasts.',
    sees: 'Every store',
  },
  {
    key: 'manager',
    name: 'Manager',
    body: 'Looks after a group of stores: their players, their conversations and their numbers.',
    sees: 'Their stores',
  },
  {
    key: 'store',
    name: 'Store',
    body: 'Records visits, answers players and keeps each player’s record current.',
    sees: 'Its own players',
  },
  {
    key: 'player',
    name: 'Player',
    body: 'Checks their balance and progress, invites friends and messages their store.',
    sees: 'Only themselves',
  },
];

/** Which nodes of the example chain each role can reach. */
const REACH: Record<Role, string[]> = {
  master: [
    'Master',
    'Manager 1',
    'Manager 2',
    'Store 11',
    'Store 12',
    'Store 21',
    'SP',
    'p2',
    'p3',
    'p4',
    'p5',
    'p6',
  ],
  manager: ['Manager 1', 'Store 11', 'Store 12', 'SP', 'p2', 'p3', 'p4'],
  store: ['Store 11', 'SP', 'p2', 'p3'],
  player: ['SP'],
};

const CHAIN = [
  {
    name: 'Manager 1',
    stores: [
      { name: 'Store 11', players: ['SP', 'p2', 'p3'] },
      { name: 'Store 12', players: ['p4'] },
    ],
  },
  { name: 'Manager 2', stores: [{ name: 'Store 21', players: ['p5', 'p6'] }] },
];

/**
 * The four roles side by side. Pointing at one (or focusing it) lights up
 * exactly what it can reach in the example chain.
 */
export function Roles() {
  const [role, setRole] = useState<Role>('store');
  const reach = new Set(REACH[role]);

  const node = (name: string) => (
    <span
      className={cn(
        'rounded-lg border px-3.5 py-2 text-center text-sm font-semibold transition-colors duration-300 sm:text-base',
        reach.has(name)
          ? 'border-lp-primary bg-lp-primary/8 text-lp-text'
          : 'border-lp-line bg-lp-sunk text-lp-dim',
      )}
    >
      {name}
    </span>
  );
  const player = (id: string) => (
    <span
      key={id}
      className={cn(
        'grid size-8 place-items-center rounded-full text-[11px] font-bold transition-colors duration-300',
        reach.has(id) ? 'bg-lp-chip text-lp-text' : 'bg-lp-sunk text-lp-dim',
      )}
    >
      {id === 'SP' ? 'SP' : ''}
      <span className="sr-only">{id === 'SP' ? '' : 'A player'}</span>
    </span>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
      <div role="radiogroup" aria-label="Role" className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((item) => (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={role === item.key}
            onClick={() => setRole(item.key)}
            onMouseEnter={() => setRole(item.key)}
            onFocus={() => setRole(item.key)}
            className={cn(
              'focus-visible:outline-lp-primary rounded-2xl border p-5 text-left transition-colors focus-visible:outline-2 sm:p-6',
              role === item.key
                ? 'border-lp-primary bg-lp-raised shadow-[0_16px_40px_-28px_rgb(47_91_255/0.6)]'
                : 'border-lp-line bg-lp-raised hover:border-lp-line-strong',
            )}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-lg font-extrabold [font-stretch:112%]">{item.name}</span>
              <span className="text-lp-primary-hover text-sm font-semibold">{item.sees}</span>
            </span>
            <span className="text-lp-dim mt-2 block leading-relaxed">{item.body}</span>
          </button>
        ))}
      </div>

      <div
        aria-hidden
        className="bg-lp-sunk border-lp-line flex flex-col items-center justify-center gap-6 rounded-3xl border p-6 sm:p-8"
      >
        {node('Master')}
        <div className="grid w-full grid-cols-2 gap-4">
          {CHAIN.map((manager) => (
            <div key={manager.name} className="flex flex-col items-center gap-4">
              {node(manager.name)}
              <div className="flex flex-wrap justify-center gap-3">
                {manager.stores.map((store) => (
                  <div key={store.name} className="flex flex-col items-center gap-2.5">
                    {node(store.name)}
                    <div className="flex gap-1">{store.players.map(player)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="bg-lp-raised border-lp-line mt-2 rounded-xl border px-4 py-2.5 text-sm">
          Signed in as <span className="font-semibold">{SIGNED_IN[role].who}</span>:{' '}
          <span className="font-semibold tabular-nums">{SIGNED_IN[role].count}</span>
        </p>
      </div>
    </div>
  );
}

const SIGNED_IN: Record<Role, { who: string; count: string }> = {
  master: { who: 'the master', count: '6 players across 3 stores' },
  manager: { who: 'Manager 1', count: '4 players across 2 stores' },
  store: { who: 'Store 11', count: '3 players' },
  player: { who: 'Savannah', count: 'her own record' },
};
