import { existsSync } from 'fs';
import { join } from 'path';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AccessMap } from '@/components/landing/access-map';
import { DashboardView } from '@/components/landing/dashboard-view';
import { ImportExportView } from '@/components/landing/import-export-view';
import { PortalView } from '@/components/landing/portal-view';
import { HeroRecord } from '@/components/landing/hero-record';
import { PlatformTour } from '@/components/landing/platform-tour';
import { SiteHeader } from '@/components/landing/site-header';
import { getCustomerAccessToken } from '@/lib/customer-session';
import { archivo } from '@/lib/fonts';
import { getAccessToken } from '@/lib/session';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Howdi chat',
  description:
    'Player data and messaging for gaming operators: transactions, VIP tiers, reward events, referrals and live messages, scoped to every store.',
};

const LIFECYCLE = [
  { title: 'Player registers', body: 'Online, or added by staff from a spreadsheet.' },
  {
    title: 'Store takes them on',
    body: 'The master assigns a manager or store before first sign-in.',
  },
  {
    title: 'Play is recorded',
    body: 'Each debit and credit updates the balance as it is entered.',
  },
  { title: 'VIP qualifies', body: 'Spend in the period moves the player into a tier.' },
  { title: 'Rewards go out', body: 'Only players who qualified can receive a reward.' },
  { title: 'Referral pays', body: 'Both bonuses post once the new player spends enough.' },
];

const PORTAL_POINTS = [
  {
    title: 'Their balance, always current',
    body: 'Every entry a store records shows up the moment it is saved.',
  },
  { title: 'Progress they can see', body: 'Players know how close they are to the next tier.' },
  { title: 'Referrals in their pocket', body: 'A personal code and link, ready to share.' },
  { title: 'A direct line to their store', body: 'Messages go to the team that looks after them.' },
];

const GET_STARTED = [
  {
    title: 'Set up your chain',
    body: 'Add your managers and stores. Each one gets its own sign-in.',
  },
  {
    title: 'Bring in your players',
    body: 'Import a spreadsheet or add players one at a time, then assign them to stores.',
  },
  {
    title: 'Start recording',
    body: 'Stores enter play as it happens. Tiers, rewards and referrals follow on their own.',
  },
];

const TRUST = [
  {
    title: 'Every change is on record',
    body: 'The audit trail keeps who changed what, with before and after values.',
  },
  {
    title: 'Staff and players sign in apart',
    body: 'Their sessions use separate keys, so one can never act as the other.',
  },
  {
    title: 'Exports follow access',
    body: 'A spreadsheet only ever contains rows the person exporting can see.',
  },
  {
    title: 'Money is never rounded',
    body: 'Amounts are stored to the cent and totalled in the database.',
  },
];

const QUESTIONS = [
  {
    q: 'Can one store see another store’s players?',
    a: 'No. A store sees its own players, a manager sees their stores, and only the master sees everything.',
  },
  {
    q: 'How are VIP tiers decided?',
    a: 'The master sets a spend target for a period. Qualification updates on every transaction, so nobody maintains a list by hand.',
  },
  {
    q: 'Can we bring our existing players?',
    a: 'Yes. Upload a spreadsheet, review each row, and import only the ones you keep.',
  },
  {
    q: 'Do players get their own login?',
    a: 'Yes. Players see their balance, VIP progress, recent rewards and referral link, and can message their store.',
  },
  {
    q: 'Can we get our data out?',
    a: 'Every list exports to a spreadsheet that matches the filters on screen.',
  },
  {
    q: 'What happens when a player is suspended?',
    a: 'They can no longer sign in. Their record and history stay intact, and staff can reactivate them at any time.',
  },
  {
    q: 'Can staff message each other?',
    a: 'Yes. Staff have their own threads, and each one is visible only to the people in it.',
  },
  {
    q: 'Does it work on a phone?',
    a: 'Yes. Staff and players can use every page on a phone, including messaging.',
  },
];

/**
 * Illustrations are generated outside the codebase and dropped into
 * `public/landing/`. Each slot renders only once its file exists, so the
 * page is complete with or without them.
 */
const landingAsset = (file: string): string | null =>
  existsSync(join(process.cwd(), 'public', 'landing', file)) ? `/landing/${file}` : null;

const HERO_ART = landingAsset('hero-objects.png');
const TRUST_ART = landingAsset('trust.png');
const CLOSING_ART = landingAsset('closing.png');

/**
 * The public front door, for operators evaluating Howdi chat.
 *
 * A signed-in visitor goes straight to their own app. Every view on this
 * page is built from the product's own components with example data, and
 * every claim describes something the product does today.
 */
export default async function LandingPage() {
  const [staffToken, customerToken] = await Promise.all([
    getAccessToken(),
    getCustomerAccessToken(),
  ]);

  if (staffToken) redirect('/dashboard');
  if (customerToken) redirect('/customer');

  const contactEmail = process.env.CONTACT_EMAIL;

  return (
    <div
      className={`${archivo.variable} font-lp bg-lp-ground text-lp-text min-h-svh antialiased [color-scheme:light]`}
    >
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] lg:gap-14 lg:px-8 lg:pt-20 lg:pb-28">
          <div className="max-w-xl">
            <h1 className="text-[2.25rem] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance [font-stretch:112%] sm:text-5xl sm:[font-stretch:125%] xl:text-[3.4rem]">
              Run every player, store and reward from one system.
            </h1>
            <p className="text-lp-dim mt-6 max-w-md text-lg leading-relaxed">
              Record play, track VIP tiers, run rewards and referrals, and message players. Each
              store sees only its own.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}?subject=Howdi%20chat%20demo`}
                  className="bg-lp-primary text-white focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg px-6 font-semibold transition-colors hover:bg-lp-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Book a demo
                </a>
              ) : (
                <Link
                  href="/login"
                  className="bg-lp-primary text-white focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg px-6 font-semibold transition-colors hover:bg-lp-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Sign in
                </Link>
              )}
              <a
                href="#platform"
                className="border-lp-line-strong hover:border-lp-dim focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg border px-6 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                See the platform
              </a>
            </div>
          </div>

          <div className={`relative ${HERO_ART ? 'lg:pt-20 lg:pr-16' : ''}`}>
            {HERO_ART && (
              <Image
                src={HERO_ART}
                alt=""
                width={1200}
                height={1200}
                priority
                className="pointer-events-none absolute -top-4 -right-6 hidden w-[18rem] select-none lg:block"
              />
            )}
            <div className="relative">
              <HeroRecord />
            </div>
          </div>
        </section>

        {/* Platform */}
        <section id="platform" className="border-lp-line scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <SectionHeading
              title="The whole operation in six tools"
              body="They share one record per player, so nothing is entered twice."
            />
            <div className="mt-12">
              <PlatformTour />
            </div>
          </div>
        </section>

        {/* Dashboard */}
        <section id="dashboard" className="border-lp-line bg-lp-sunk scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <SectionHeading
              title="Know where every store stands"
              body="Money in, money out and top games, for the stores you can see."
            />
            <div className="mt-12">
              <DashboardView />
            </div>
          </div>
        </section>

        {/* Lifecycle */}
        <section id="lifecycle" className="border-lp-line scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <SectionHeading
              title="From sign-up to reward"
              body="Each step triggers the next. Staff only enter the play."
            />
            <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-lp-line bg-lp-line sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {LIFECYCLE.map((step, index) => (
                <li key={step.title} className="bg-lp-raised flex flex-col gap-3 p-6">
                  <span className="tabular text-lp-chip-text text-sm font-semibold">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-lp-dim text-sm leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Player portal */}
        <section id="players" className="border-lp-line bg-lp-sunk scroll-mt-16 border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
            <div>
              <SectionHeading
                title="Players get a view of their own"
                body="A separate sign-in where players check their standing and talk to their store."
              />
              <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {PORTAL_POINTS.map((item) => (
                  <div key={item.title} className="border-lp-line-strong border-t pt-5">
                    <dt className="font-semibold">{item.title}</dt>
                    <dd className="text-lp-dim mt-2 text-sm leading-relaxed">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <PortalView />
          </div>
        </section>

        {/* Access */}
        <section id="access" className="border-lp-line scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <SectionHeading
              title="Each store sees its own players"
              body="Pick a role to see exactly what it can reach."
            />
            <div className="mt-12">
              <AccessMap />
            </div>
          </div>
        </section>

        {/* Import and export */}
        <section className="border-lp-line bg-lp-sunk border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <SectionHeading
              title="Bring your players. Take your data."
              body="Check every row before it is imported, and export any list exactly as it appears."
            />
            <div className="mt-12">
              <ImportExportView />
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="border-lp-line border-t">
          <div
            className={`mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:px-8 lg:py-28 ${TRUST_ART ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center' : ''}`}
          >
            {TRUST_ART && (
              <Image
                src={TRUST_ART}
                alt=""
                width={1200}
                height={1200}
                className="mx-auto w-full max-w-sm select-none lg:max-w-none"
              />
            )}
            <div>
              <SectionHeading
                title="Built to be trusted with money"
                body="The rules that matter are enforced by the system, not left to habit."
              />
              <dl
                className={`mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 ${TRUST_ART ? '' : 'lg:grid-cols-4'}`}
              >
                {TRUST.map((item) => (
                  <div key={item.title} className="border-lp-line-strong border-t pt-5">
                    <dt className="font-semibold">{item.title}</dt>
                    <dd className="text-lp-dim mt-2 text-sm leading-relaxed">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Getting started */}
        <section className="border-lp-line bg-lp-sunk border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <SectionHeading
              title="Getting started"
              body="Three steps from an empty system to stores recording play."
            />
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {GET_STARTED.map((step, index) => (
                <li key={step.title} className="border-lp-primary border-t-2 pt-6">
                  <span className="tabular text-lp-primary text-4xl font-extrabold [font-stretch:125%]">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="text-lp-dim mt-2 leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Questions */}
        <section id="questions" className="border-lp-line scroll-mt-16 border-t">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:px-8 lg:py-28">
            <SectionHeading title="Questions operators ask" />
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

        {/* Closing */}
        <section className="border-lp-line bg-lp-sunk border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8 lg:py-24">
            <div className="flex flex-col items-start gap-8">
              <h2 className="max-w-2xl text-4xl leading-[1.05] font-extrabold tracking-[-0.02em] text-balance [font-stretch:125%] sm:text-5xl">
                See it with your own players.
              </h2>
              <div className="flex flex-wrap gap-3">
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}?subject=Howdi%20chat%20demo`}
                    className="bg-lp-primary text-white focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg px-6 font-semibold transition-colors hover:bg-lp-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Book a demo
                  </a>
                )}
                <Link
                  href="/login"
                  className={
                    contactEmail
                      ? 'border-lp-line-strong hover:border-lp-dim focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg border px-6 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'
                      : 'bg-lp-primary text-white focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg px-6 font-semibold transition-colors hover:bg-lp-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2'
                  }
                >
                  Sign in
                </Link>
              </div>
            </div>
            {CLOSING_ART && (
              <Image
                src={CLOSING_ART}
                alt=""
                width={1000}
                height={1000}
                className="mx-auto w-64 select-none sm:w-72 lg:w-96"
              />
            )}
          </div>
        </section>
      </main>

      <footer className="border-lp-line border-t">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 text-sm sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
          <div className="max-w-xs">
            <Logo tone="site" />
            <p className="text-lp-dim mt-3 leading-relaxed">
              Player data and messaging for gaming operators, scoped to every store.
            </p>
          </div>
          <nav aria-label="Product" className="flex flex-col gap-2.5">
            <p className="font-semibold">Product</p>
            {[
              ['#platform', 'Platform'],
              ['#dashboard', 'Dashboard'],
              ['#players', 'Player portal'],
              ['#access', 'Access'],
              ['#questions', 'Questions'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-lp-dim hover:text-lp-text w-fit transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
          <nav aria-label="Sign in" className="flex flex-col gap-2.5">
            <p className="font-semibold">Sign in</p>
            <Link href="/login" className="text-lp-dim hover:text-lp-text w-fit transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-lp-dim hover:text-lp-text w-fit transition-colors"
            >
              Create a player account
            </Link>
          </nav>
        </div>
        <div className="border-lp-line text-lp-dim mx-auto w-full max-w-7xl border-t px-4 py-6 text-xs sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Howdi chat
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl leading-[1.08] font-extrabold tracking-[-0.015em] text-balance [font-stretch:118%] sm:text-4xl">
        {title}
      </h2>
      {body && <p className="text-lp-dim mt-4 text-lg leading-relaxed">{body}</p>}
    </div>
  );
}
