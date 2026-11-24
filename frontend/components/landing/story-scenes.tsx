'use client';

import Image from 'next/image';
import { CheckCheckIcon, CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/*
 * The scenes on the story's stage. Each one takes `progress` from 0 to 1
 * and draws that moment of the chapter, so the same scene can be driven by
 * scroll position (the pinned desktop stage) or by a short timer (phones).
 * Progress 1 is always the finished picture, which is what reduced-motion
 * visitors and the first server render see.
 */

export interface SceneProps {
  progress: number;
}

const card =
  'border-lp-line bg-lp-raised rounded-2xl border shadow-[0_30px_70px_-40px_rgb(18_26_43/0.45)]';
const at = (progress: number, from: number) => progress >= from;
const ease = 'transition-all duration-500 ease-out';

/* 1. A new face walks in ----------------------------------------------- */

export function SignupScene({ progress }: SceneProps) {
  const assigned = at(progress, 0.5);
  return (
    <div className={cn(card, 'w-full max-w-sm p-6')}>
      <div className="flex items-center gap-3">
        <span className="bg-lp-chip/40 grid size-12 place-items-center rounded-full font-bold">
          SP
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Savannah Pruitt</p>
          <p className="text-lp-dim truncate text-sm">savannah.p@example.com</p>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-bold',
            ease,
            assigned ? 'bg-lp-ok/12 text-lp-ok' : 'bg-lp-chip/40 text-lp-chip-text',
          )}
        >
          {assigned ? 'Active' : 'Pending'}
        </span>
      </div>
      <dl className="border-lp-line mt-5 grid grid-cols-2 gap-4 border-t pt-5 text-sm">
        <div>
          <dt className="text-lp-dim text-xs">Joined</dt>
          <dd className="mt-1 font-medium">Today, 5:48 PM</dd>
        </div>
        <div>
          <dt className="text-lp-dim text-xs">Store</dt>
          <dd className="mt-1 font-medium">
            <span
              className={cn(
                'inline-block',
                ease,
                assigned ? 'scale-100 opacity-100' : 'scale-150 -rotate-6 opacity-0',
              )}
            >
              <span className="border-lp-primary text-lp-primary rounded-md border-2 px-2 py-0.5 text-xs font-extrabold tracking-wide uppercase">
                Store 11
              </span>
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* 2. Howdy, Savannah --------------------------------------------------- */

const CHAT = [
  { from: 'player', body: 'Howdy! First time here, how do I top up?', time: '5:52 PM' },
  {
    from: 'staff',
    body: 'Welcome in, Savannah! Swing by the counter or send it here.',
    time: '5:53 PM',
  },
  { from: 'player', body: 'Sent you the receipt just now', time: '5:58 PM' },
  { from: 'staff', body: 'Got it, all set. Holler if you need anything.', time: '5:59 PM' },
] as const;

export function ChatScene({ progress }: SceneProps) {
  // Each message takes a quarter of the chapter: typing, then the message.
  const step = progress * CHAT.length;
  const shown = Math.min(CHAT.length, Math.floor(step + 0.0001));
  const typingFrom = shown < CHAT.length && step - shown > 0.35 ? CHAT[shown].from : null;

  return (
    <div className={cn(card, 'w-full max-w-md overflow-hidden')}>
      <div className="border-lp-line flex items-center gap-3 border-b px-4 py-3">
        <span className="bg-lp-chip/40 relative grid size-10 place-items-center rounded-full text-sm font-bold">
          SP
          <span className="bg-lp-ok ring-lp-raised absolute right-0 bottom-0 size-2.5 rounded-full ring-2" />
        </span>
        <div>
          <p className="font-semibold">Savannah Pruitt</p>
          <p className="text-lp-ok text-xs">{typingFrom === 'player' ? 'typing…' : 'Online'}</p>
        </div>
      </div>
      <div className="bg-lp-sunk flex h-[19rem] flex-col justify-end gap-2 p-4">
        {CHAT.slice(0, shown).map((line, index) => {
          const mine = line.from === 'staff';
          // The player reads each reply once they answer it, or at the end.
          const read = index < shown - 1 || progress >= 1;
          return (
            <div
              key={index}
              className={cn(
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 flex max-w-[85%] items-end gap-2 rounded-2xl px-3.5 py-2 text-[15px] leading-snug',
                mine
                  ? 'bg-lp-primary self-end rounded-br-md text-white'
                  : 'bg-lp-raised border-lp-line self-start rounded-bl-md border',
              )}
            >
              <span>{line.body}</span>
              <span
                className={cn(
                  'flex shrink-0 translate-y-0.5 items-center gap-1 text-[11px]',
                  mine ? 'text-white' : 'text-lp-dim',
                )}
              >
                {line.time}
                {mine &&
                  (read ? (
                    <CheckCheckIcon className="size-3.5" aria-label="Read" />
                  ) : (
                    <CheckIcon className="size-3.5" aria-label="Sent" />
                  ))}
              </span>
            </div>
          );
        })}
        {typingFrom && (
          <span
            className={cn(
              'flex w-fit gap-1 rounded-2xl px-3.5 py-3',
              typingFrom === 'staff'
                ? 'bg-lp-primary/85 self-end rounded-br-md'
                : 'bg-lp-raised border-lp-line self-start rounded-bl-md border',
            )}
          >
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={cn(
                  'size-1.5 animate-bounce rounded-full',
                  typingFrom === 'staff' ? 'bg-white' : 'bg-lp-dim',
                )}
                style={{ animationDelay: `${dot * 150}ms` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/* 3. Every visit, on the record ---------------------------------------- */

const ENTRIES = [
  { game: 'Ocean Quest', when: 'Fri, 6:12 PM', amount: 250 },
  { game: 'Star Arena', when: 'Sat, 2:40 PM', amount: 120 },
];
const OPENING = 0;

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function RecordScene({ progress }: SceneProps) {
  const landed = ENTRIES.filter((_, index) => at(progress, 0.3 + index * 0.35));
  const balance = OPENING + landed.reduce((sum, entry) => sum + entry.amount, 0);
  return (
    <div className={cn(card, 'w-full max-w-sm p-6')}>
      <p className="text-lp-dim text-sm">Savannah’s balance</p>
      <p
        key={balance}
        className="motion-safe:animate-in motion-safe:fade-in mt-1 text-5xl font-extrabold tabular-nums [font-stretch:115%]"
      >
        {dollars.format(balance)}
      </p>
      <ul className="border-lp-line mt-6 min-h-[8.5rem] divide-y border-t">
        {[...landed].reverse().map((entry) => (
          <li
            key={entry.game}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 flex items-center justify-between py-3"
          >
            <span>
              <span className="block font-medium">{entry.game}</span>
              <span className="text-lp-dim text-xs">Money in, {entry.when}</span>
            </span>
            <span className="text-lp-ok font-semibold tabular-nums">
              +{dollars.format(entry.amount)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-lp-dim text-xs">Recorded by Store 11</p>
    </div>
  );
}

/* 4. She keeps coming back --------------------------------------------- */

const TIERS = ['Bronze', 'Silver', 'Gold'];
const MEDALS = [
  { key: 'joined', label: 'Joined' },
  { key: 'first_message', label: 'First message' },
  { key: 'three_months', label: '3 months' },
  { key: 'vip', label: 'Made VIP' },
];

export function ProgressScene({ progress }: SceneProps) {
  const reached = Math.min(2, Math.floor(progress * 2.2 + 0.0001));
  const earned = Math.min(MEDALS.length, Math.floor(Math.max(0, progress - 0.25) * 5.4 + 0.0001));
  return (
    <div className={cn(card, 'w-full max-w-sm space-y-5 p-6')}>
      <div>
        <div className="flex items-center justify-between">
          <p className="font-semibold">VIP</p>
          <span className="bg-lp-chip rounded-full px-2.5 py-0.5 text-xs font-bold">
            {TIERS[reached]}
          </span>
        </div>
        <ol className="mt-4 flex">
          {TIERS.map((tier, index) => {
            const on = index <= reached;
            return (
              <li key={tier} className="relative flex flex-1 flex-col items-center">
                {index > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-4 right-1/2 h-1 w-full -translate-y-1/2 rounded-full',
                      ease,
                      on ? 'bg-lp-chip' : 'bg-lp-sunk',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 grid size-8 place-items-center rounded-full text-xs font-bold',
                    ease,
                    on ? 'bg-lp-chip' : 'bg-lp-sunk text-lp-dim',
                  )}
                >
                  {on ? <CheckIcon className="size-4" strokeWidth={3} /> : index + 1}
                </span>
                <span className="mt-1.5 text-xs font-semibold">{tier}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="border-lp-line border-t pt-5">
        <div className="flex items-center justify-between text-sm">
          <p className="font-semibold">Milestones</p>
          <span className="text-lp-dim tabular-nums">{earned} of 8</span>
        </div>
        <ul className="mt-3 grid grid-cols-4 gap-1">
          {MEDALS.map((medal, index) => {
            const on = index < earned;
            return (
              <li key={medal.key} className="flex flex-col items-center text-center">
                <Image
                  src={`/brand/badges/${medal.key}.webp`}
                  alt=""
                  width={128}
                  height={128}
                  className={cn(
                    'size-14 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                    on ? 'scale-100' : 'scale-75 opacity-30 grayscale',
                  )}
                />
                <span
                  className={cn(
                    'mt-1 text-[11px] leading-tight',
                    on ? 'font-semibold' : 'text-lp-dim',
                  )}
                >
                  {medal.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* 5. And brings her friends -------------------------------------------- */

const FRIENDS = [
  { initials: 'JB', name: 'Jolene Brooks', tone: 'bg-sky-200' },
  { initials: 'WH', name: 'Wade Harper', tone: 'bg-lp-chip/50' },
];

export function FriendsScene({ progress }: SceneProps) {
  const joined = FRIENDS.filter((_, index) => at(progress, 0.3 + index * 0.3)).length;
  return (
    <div className={cn(card, 'w-full max-w-sm p-6')}>
      <div className="flex items-center justify-center py-4">
        <span className="bg-lp-chip/40 ring-lp-raised relative z-10 grid size-16 place-items-center rounded-full text-lg font-bold ring-4">
          SP
        </span>
        {FRIENDS.map((friend, index) => (
          <span
            key={friend.initials}
            className={cn(
              'ring-lp-raised -ml-3 grid size-14 place-items-center rounded-full font-bold ring-4',
              friend.tone,
              ease,
              index < joined ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0',
            )}
          >
            {friend.initials}
          </span>
        ))}
      </div>
      <p className="mt-2 text-center text-sm">
        <span className="text-2xl font-bold tabular-nums">{joined}</span>
        <span className="text-lp-dim"> of 5 friends joined</span>
      </p>
      <div className="bg-lp-sunk mt-2 h-2.5 overflow-hidden rounded-full">
        <div
          className={cn('bg-lp-ok h-full rounded-full', ease)}
          style={{ width: `${(joined / 5) * 100}%` }}
        />
      </div>
      <ul className="mt-5 space-y-2 text-sm">
        {FRIENDS.slice(0, joined).map((friend) => (
          <li
            key={friend.name}
            className="motion-safe:animate-in motion-safe:fade-in flex items-center justify-between"
          >
            <span>{friend.name} joined</span>
            <span className="text-lp-ok font-semibold">+$25.00</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 6. Behind the counter ------------------------------------------------ */

const CHAIN = [
  { name: 'Manager 1', stores: ['Store 11', 'Store 12'] },
  { name: 'Manager 2', stores: ['Store 21'] },
];

export function AccessScene({ progress }: SceneProps) {
  // The view narrows from the master's whole chain down to one store.
  const focus = at(progress, 0.66) ? 'store' : at(progress, 0.33) ? 'manager' : 'master';
  const lit = (name: string) =>
    focus === 'master' ||
    (focus === 'manager' && ['Manager 1', 'Store 11', 'Store 12'].includes(name)) ||
    (focus === 'store' && name === 'Store 11');

  const node = (name: string) => (
    <span
      className={cn(
        'rounded-lg border px-3 py-2 text-center text-sm font-semibold',
        ease,
        lit(name)
          ? 'border-lp-primary bg-lp-primary/8 text-lp-text'
          : 'border-lp-line bg-lp-sunk text-lp-dim',
      )}
    >
      {name}
    </span>
  );

  return (
    <div className={cn(card, 'w-full max-w-md p-6')}>
      <div className="flex justify-center">{node('Master')}</div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {CHAIN.map((manager) => (
          <div key={manager.name} className="flex flex-col items-center gap-3">
            {node(manager.name)}
            <div className="flex flex-wrap justify-center gap-2">
              {manager.stores.map((store) => (
                <span key={store}>{node(store)}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="bg-lp-sunk mt-6 rounded-xl p-3 text-center text-sm">
        Signed in as{' '}
        <span className="font-semibold">
          {focus === 'master' ? 'the master' : focus === 'manager' ? 'Manager 1' : 'Store 11'}
        </span>
        :{' '}
        <span className="font-semibold tabular-nums">
          {focus === 'master' ? '36' : focus === 'manager' ? '17' : '9'}
        </span>{' '}
        players
      </p>
    </div>
  );
}

/* The mascot in the corner of each scene. */
export function SceneArt({ src, className }: { src: string; className?: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={480}
      height={480}
      className={cn('pointer-events-none w-full select-none', className)}
    />
  );
}
