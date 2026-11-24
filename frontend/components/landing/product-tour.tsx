'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

const TABS = [
  {
    key: 'inbox',
    label: 'Inbox',
    title: 'Every conversation, in one inbox',
    body: 'Players message the store that looks after them. Staff see who’s online and typing, and what’s been read.',
    points: ['Presence, typing and read receipts', 'Photos and files', 'Team threads for staff'],
    image: { src: '/product/inbox.webp', alt: 'The staff inbox with a player conversation open' },
  },
  {
    key: 'record',
    label: 'Player record',
    title: 'One record for every player',
    body: 'Balance, visits, VIP status and referrals on one page, recorded by the store.',
    points: [
      'Visits recorded as they happen',
      'Corrections kept apart',
      'Full history, exportable',
    ],
    image: {
      src: '/product/player-record.webp',
      alt: 'A player record with balance and money in and out',
    },
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    title: 'Where every store stands',
    body: 'This month’s money in and out, who needs attention, and the trend, for exactly the stores you can see.',
    points: [
      'Players waiting on approval or a reply',
      'Day, week and month views',
      'Same numbers at every level',
    ],
    image: {
      src: '/product/dashboard.webp',
      alt: 'The dashboard with this month’s figures and a chart',
    },
  },
  {
    key: 'portal',
    label: 'Player portal',
    title: 'A portal players come back to',
    body: 'Players see their balance, their route to the next tier, the milestones they’ve earned and their invite link.',
    points: [
      'Separate player sign-in',
      'Milestones for loyalty, not spending',
      'A direct line to their store',
    ],
    image: { src: '/product/portal.webp', alt: 'The player portal on a phone' },
  },
] as const;

/** The product's main screens behind tabs, one large real screenshot at a time. */
export function ProductTour() {
  const [current, setCurrent] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = TABS[current];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (current + step + TABS.length) % TABS.length;
    setCurrent(next);
    tabs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Product screens"
        onKeyDown={onKeyDown}
        className="bg-lp-sunk border-lp-line inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border p-1"
      >
        {TABS.map((item, index) => (
          <button
            key={item.key}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tour-tab-${item.key}`}
            aria-selected={index === current}
            aria-controls="tour-panel"
            tabIndex={index === current ? 0 : -1}
            onClick={() => setCurrent(index)}
            className={cn(
              'focus-visible:outline-lp-primary rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 sm:px-5',
              index === current
                ? 'bg-lp-raised text-lp-text shadow-[0_4px_14px_-8px_rgb(18_26_43/0.35)]'
                : 'text-lp-dim hover:text-lp-text',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id="tour-panel"
        role="tabpanel"
        aria-labelledby={`tour-tab-${tab.key}`}
        className="mt-8 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-14"
      >
        <div key={tab.key} className="motion-safe:animate-in motion-safe:fade-in">
          <h3 className="text-2xl leading-tight font-extrabold [font-stretch:112%] sm:text-3xl">
            {tab.title}
          </h3>
          <p className="text-lp-dim mt-4 text-lg leading-relaxed">{tab.body}</p>
          <ul className="mt-6 space-y-2.5">
            {tab.points.map((point) => (
              <li key={point} className="border-lp-primary border-l-2 pl-3 font-medium">
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-lp-sunk border-lp-line relative flex min-h-[18rem] items-center justify-center overflow-hidden rounded-3xl border p-4 sm:min-h-[26rem] sm:p-8">
          {TABS.map((item, index) => (
            <div
              key={item.key}
              aria-hidden={index !== current}
              className={cn(
                'transition-opacity duration-500',
                index === current
                  ? 'relative opacity-100'
                  : 'pointer-events-none absolute inset-4 opacity-0 sm:inset-8',
              )}
            >
              {item.key === 'portal' ? (
                <div className="border-lp-text mx-auto w-48 overflow-hidden rounded-[1.75rem] border-[6px] shadow-[0_30px_60px_-30px_rgb(18_26_43/0.55)] sm:w-56">
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    width={780}
                    height={1688}
                    sizes="224px"
                  />
                </div>
              ) : (
                <div className="border-lp-line bg-lp-raised overflow-hidden rounded-xl border p-1 shadow-[0_30px_60px_-30px_rgb(18_26_43/0.45)]">
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    width={2000}
                    height={1250}
                    sizes="(min-width: 1024px) 760px, 100vw"
                    className="rounded-lg"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
