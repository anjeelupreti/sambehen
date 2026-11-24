import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { PageIntro } from '@/components/landing/site-shell';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Product',
  description:
    'The Howdi chat staff inbox, player records, store dashboard and player portal, as they look today.',
};

const FEATURES = [
  {
    title: 'Answer players while they’re still there',
    body: 'Every player’s conversation lands with the store that looks after them. Staff see who’s online, who’s typing and what’s been read, and can send photos and files.',
    points: [
      'Live presence, typing and read receipts',
      'Photos and files, pasted or dropped',
      'A floating chat on every staff page',
    ],
    image: { src: '/product/inbox.webp', alt: 'Staff inbox with a player conversation open' },
  },
  {
    title: 'One record for every player',
    body: 'Balance, money in and out, recent visits, VIP status and referrals sit on one page, recorded by the store and visible to the people above it.',
    points: [
      'Visits recorded as they happen',
      'Corrections kept apart from money out',
      'Full history, exportable',
    ],
    image: {
      src: '/product/player-record.webp',
      alt: 'A player record showing balance and money in and out',
    },
  },
  {
    title: 'See where each store stands',
    body: 'The dashboard shows this month’s money in and out, who needs attention and the trend over time, for exactly the stores the person signed in can see.',
    points: [
      'Players waiting for approval or a reply',
      'Day, week and month views',
      'The same numbers for master, manager and store',
    ],
    image: {
      src: '/product/dashboard.webp',
      alt: 'The store dashboard with this month’s figures and a chart',
    },
  },
];

const ALSO = [
  ['VIP tiers', 'Set a target for a period; players qualify automatically.'],
  ['Referrals', 'Invite links per player, with bonuses posted once a friend plays.'],
  ['Broadcast email', 'Write once, send to every player or only the ones you pick.'],
  ['Team chat', 'Stores, managers and the master message each other.'],
  ['Import and export', 'Bring players in from a spreadsheet; export any list as shown.'],
  ['Audit trail', 'Every change, with who made it and what it was before.'],
];

export default function ProductPage() {
  return (
    <>
      <PageIntro
        title="Everything a store needs to look after its players"
        body="These are the real screens, with demo data. Staff work in the app; players get a portal of their own."
      />

      <div className="mx-auto w-full max-w-7xl space-y-24 px-4 py-20 sm:px-6 lg:space-y-32 lg:px-8 lg:py-28">
        {FEATURES.map((feature, index) => (
          <section
            key={feature.title}
            className="grid items-center gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16"
          >
            <div className={cn(index % 2 === 1 && 'lg:order-2')}>
              <h2 className="text-3xl leading-[1.08] font-extrabold tracking-[-0.015em] text-balance [font-stretch:118%] sm:text-4xl">
                {feature.title}
              </h2>
              <p className="text-lp-dim mt-4 text-lg leading-relaxed">{feature.body}</p>
              <ul className="mt-6 space-y-2.5">
                {feature.points.map((point) => (
                  <li key={point} className="border-lp-primary border-l-2 pl-3 font-medium">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-lp-line bg-lp-raised overflow-hidden rounded-xl border p-1.5 shadow-[0_30px_70px_-40px_rgb(18_26_43/0.45)]">
              <Image
                src={feature.image.src}
                alt={feature.image.alt}
                width={2000}
                height={1250}
                sizes="(min-width: 1024px) 720px, 100vw"
                className="rounded-lg"
              />
            </div>
          </section>
        ))}

        <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16">
          <div>
            <h2 className="text-3xl leading-[1.08] font-extrabold tracking-[-0.015em] text-balance [font-stretch:118%] sm:text-4xl">
              A portal for players
            </h2>
            <p className="text-lp-dim mt-4 max-w-xl text-lg leading-relaxed">
              Players sign in separately to see their balance, how close they are to the next tier,
              the milestones they’ve earned and their invite link, and to message their store.
              Milestones reward joining, talking and inviting friends, never spending.
            </p>
          </div>
          <div className="mx-auto w-64 overflow-hidden rounded-[2rem] border-[6px] border-lp-text shadow-[0_30px_70px_-30px_rgb(18_26_43/0.55)] sm:w-72">
            <Image
              src="/product/portal.webp"
              alt="The player portal on a phone, with balance, VIP route and milestones"
              width={780}
              height={1688}
              sizes="288px"
            />
          </div>
        </section>

        <section>
          <h2 className="text-3xl leading-[1.08] font-extrabold tracking-[-0.015em] [font-stretch:118%] sm:text-4xl">
            Also included
          </h2>
          <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {ALSO.map(([title, body]) => (
              <div key={title} className="border-lp-line-strong border-t pt-5">
                <dt className="font-semibold">{title}</dt>
                <dd className="text-lp-dim mt-2 leading-relaxed">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-lp-primary rounded-3xl px-6 py-14 text-center text-white sm:px-12">
          <h2 className="text-3xl font-extrabold text-balance [font-stretch:118%] sm:text-4xl">
            See it with your own stores
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="text-lp-primary inline-flex h-12 items-center rounded-lg bg-white px-6 font-semibold hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-lg border border-white/60 px-6 font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Pricing
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
