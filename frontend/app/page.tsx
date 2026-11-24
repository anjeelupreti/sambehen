import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Parallax, SmoothScroll } from '@/components/landing/motion';
import {
  COMPANY,
  primaryButton,
  secondaryButton,
  SiteShell,
} from '@/components/landing/site-shell';
import { Bento } from '@/components/landing/bento';
import { ProductTour } from '@/components/landing/product-tour';
import { Roles } from '@/components/landing/roles';
import { getCustomerAccessToken } from '@/lib/customer-session';
import { getAccessToken } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Howdi chat',
  description:
    'Live chat and player records for gaming operators: messaging, visits, VIP tiers, milestones and referrals, store by store.',
};

const SECURITY = [
  [
    'Each store sees only its own',
    'Access is checked on every request, including exports and live chat.',
  ],
  ['Separate sign-ins', 'Staff and players use different keys and can never act as each other.'],
  ['Every change on record', 'The audit trail keeps who changed what, and what it was before.'],
  ['Money is exact', 'Amounts are stored to the cent and never rounded.'],
] as const;

const QUESTIONS = [
  {
    q: 'Can one store see another store’s players?',
    a: 'No. A store sees its own players, a manager sees their stores, and only the master sees everything.',
  },
  {
    q: 'Can we bring our existing players?',
    a: 'Yes. Upload a spreadsheet, review each row, and import only the ones you keep.',
  },
  {
    q: 'How are VIP tiers decided?',
    a: 'The master sets a target for a period. Qualification updates with every recorded visit, so nobody keeps a list by hand.',
  },
  {
    q: 'Do players get their own login?',
    a: 'Yes. Players see their balance, tiers, milestones and invite link, and can message their store.',
  },
  {
    q: 'Can staff message each other?',
    a: 'Yes. Stores, managers and the master have their own threads, visible only to the people in them.',
  },
  {
    q: 'Can we get our data out?',
    a: 'Every list exports to a spreadsheet that matches the filters on screen.',
  },
];

/**
 * The public front door: one player's first months with a store, told in
 * chapters, each showing the part of the product that made it happen.
 * A signed-in visitor goes straight to their own app.
 */
export default async function LandingPage() {
  const [staffToken, customerToken] = await Promise.all([
    getAccessToken(),
    getCustomerAccessToken(),
  ]);

  if (staffToken) redirect('/dashboard');
  if (customerToken) redirect('/customer');

  const cta = (light = false) => (
    <div className="flex flex-wrap justify-center gap-3">
      <Link
        href="/contact"
        className={
          light
            ? 'text-lp-primary focus-visible:outline-white inline-flex h-12 items-center rounded-lg bg-white px-6 font-semibold transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2'
            : primaryButton
        }
      >
        Book a demo
      </Link>
      <Link
        href="/product"
        className={
          light
            ? 'focus-visible:outline-white inline-flex h-12 items-center rounded-lg border border-white/60 px-6 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2'
            : secondaryButton
        }
      >
        See the product
      </Link>
    </div>
  );

  return (
    <SiteShell underHeader>
      <SmoothScroll />
      {/* Opening: the product under an open sky. */}
      <section className="lp-grain overflow-hidden">
        <Image
          src="/brand/sky.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={92}
          unoptimized
          className="-z-10 object-cover object-top"
        />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-36 text-center sm:px-6 lg:pt-44">
          <h1 className="max-w-3xl text-[2.75rem] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance text-white [font-stretch:112%] sm:text-6xl sm:[font-stretch:125%] lg:text-7xl">
            Every player has a story.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90 sm:text-xl">
            {COMPANY.product} keeps it: their conversations, their visits, their progress. For
            gaming operators, store by store.
          </p>
          <div className="mt-9">{cta(true)}</div>

          <div className="relative mt-16 w-full max-w-5xl lg:mt-20">
            <Parallax
              distance={40}
              tilt={5}
              className="absolute -top-14 right-0 z-20 w-24 sm:-top-28 sm:-right-8 sm:w-40 lg:-top-32 lg:-right-16 lg:w-48"
            >
              <Image
                src="/brand/mascot/waving.webp"
                alt=""
                width={480}
                height={480}
                priority
                className="w-full select-none"
              />
            </Parallax>
            <div className="h-[15rem] border-white/60 overflow-hidden rounded-t-2xl sm:h-[26rem] lg:h-[32rem] border border-b-0 bg-white/40 p-2 pb-0 shadow-[0_40px_90px_-30px_rgb(18_26_43/0.55)] backdrop-blur-sm sm:p-3 sm:pb-0">
              <Image
                src="/product/inbox.webp"
                alt="The Howdi chat staff inbox, with a player's conversation open"
                width={2000}
                height={1250}
                priority
                sizes="(min-width: 1024px) 1000px, 100vw"
                className="rounded-t-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product tour */}
      <section id="product" className="scroll-mt-24">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <SectionHeading
            title="The whole operation, in one place"
            body="Real screens from Howdi chat, with demo data."
          />
          <div className="mt-12">
            <ProductTour />
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="border-lp-line bg-lp-sunk/60 border-t">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <SectionHeading
            title="Built around the player"
            body="Conversations, visits and progress, kept together so every store knows its players."
          />
          <div className="mt-12">
            <Bento />
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="border-lp-line border-t">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading
              title="Built for every role"
              body="Everyone sees exactly their share of the chain. Pick a role to see its reach."
            />
            <Parallax distance={30} tilt={4} className="hidden w-36 shrink-0 sm:block lg:w-44">
              <Image
                src="/brand/mascot/door.webp"
                alt=""
                width={480}
                height={480}
                className="w-full select-none"
              />
            </Parallax>
          </div>
          <div className="mt-12">
            <Roles />
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="bg-lp-text text-white">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16 lg:px-8 lg:py-24">
          <Parallax distance={40} tilt={4} className="mx-auto w-48 sm:w-60 lg:w-full lg:max-w-xs">
            <Image
              src="/brand/mascot/shield.webp"
              alt=""
              width={480}
              height={480}
              className="w-full select-none"
            />
          </Parallax>
          <div>
            <h2 className="text-3xl leading-[1.08] font-extrabold tracking-[-0.015em] text-balance [font-stretch:118%] sm:text-4xl">
              Built to be trusted with money
            </h2>
            <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {SECURITY.map(([title, body]) => (
                <div key={title} className="border-t border-white/20 pt-5">
                  <dt className="font-semibold">{title}</dt>
                  <dd className="mt-2 leading-relaxed text-white/75">{body}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/security"
              className="mt-10 inline-flex h-11 items-center rounded-lg border border-white/40 px-5 font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              How we protect data
            </Link>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section id="questions" className="border-lp-line scroll-mt-16 border-t">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:px-8 lg:py-28">
          <div>
            <h2 className="text-3xl leading-[1.08] font-extrabold tracking-[-0.015em] text-balance [font-stretch:118%] sm:text-4xl">
              Questions operators ask
            </h2>
            <Image
              src="/brand/mascot/resting.webp"
              alt=""
              width={480}
              height={480}
              className="mt-10 hidden w-44 select-none lg:block"
            />
          </div>
          <div className="divide-lp-line border-lp-line divide-y border-y">
            {QUESTIONS.map((item) => (
              <details key={item.q} className="group">
                <summary className="focus-visible:outline-lp-primary flex cursor-pointer list-none items-center justify-between gap-6 rounded py-5 font-medium focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="text-lp-dim text-xl leading-none transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="text-lp-dim max-w-2xl pb-6 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      {/* Closing, back under the sky */}
      <section className="lp-grain relative overflow-hidden">
        <Image
          src="/brand/sky.webp"
          alt=""
          fill
          sizes="100vw"
          unoptimized
          className="-z-10 object-cover object-top"
        />
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:py-32">
          <Parallax distance={40} tilt={5} className="w-36 sm:w-44">
            <Image
              src="/brand/mascot/waving.webp"
              alt=""
              width={480}
              height={480}
              className="w-full select-none"
            />
          </Parallax>
          <h2 className="mt-6 text-4xl leading-[1.04] font-extrabold tracking-[-0.02em] text-balance text-white [font-stretch:125%] sm:text-6xl">
            Say howdy to your players.
          </h2>
          <div className="mt-9">{cta(true)}</div>
        </div>
      </section>
    </SiteShell>
  );
}

function SectionHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl leading-[1.08] font-extrabold tracking-[-0.015em] text-balance [font-stretch:118%] sm:text-5xl">
        {title}
      </h2>
      {body && <p className="text-lp-dim mt-4 text-lg leading-relaxed">{body}</p>}
    </div>
  );
}
