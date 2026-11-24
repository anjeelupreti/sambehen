import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Parallax, SmoothScroll } from '@/components/landing/motion';
import { SiteHeader } from '@/components/landing/site-header';
import { Story, type ChapterKey } from '@/components/landing/story';
import { Logo } from '@/components/logo';
import { getCustomerAccessToken } from '@/lib/customer-session';
import { archivo } from '@/lib/fonts';
import { publicAsset } from '@/lib/public-asset';
import { getAccessToken } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Howdi chat',
  description:
    'Live chat and player records for gaming operators. Follow one player from sign-up to friends, store by store.',
};

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

/** A mascot pose, or a stand-in until the pose has been added. */
const pose = (name: string, fallback: string) =>
  publicAsset(`brand/mascot/${name}.webp`) ?? `/brand/mascot/${fallback}.webp`;

const primaryButton =
  'bg-lp-primary text-white focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg px-6 font-semibold transition-colors hover:bg-lp-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2';
const secondaryButton =
  'border-lp-line-strong hover:border-lp-dim focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg border px-6 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';

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

  const contactEmail = process.env.CONTACT_EMAIL;
  const art: Record<ChapterKey, string> = {
    arrives: pose('door', 'waving'),
    chat: pose('megaphone', 'waving'),
    record: pose('clipboard', 'shield'),
    progress: pose('trophy', 'waving'),
    friends: pose('friends', 'trophy'),
    operators: pose('shield', 'waving'),
  };

  const cta = (
    <div className="flex flex-wrap justify-center gap-3">
      {contactEmail ? (
        <a href={`mailto:${contactEmail}?subject=Howdi%20chat%20demo`} className={primaryButton}>
          Book a demo
        </a>
      ) : null}
      <Link href="/login" className={contactEmail ? secondaryButton : primaryButton}>
        Sign in
      </Link>
    </div>
  );

  return (
    <div
      className={`${archivo.variable} font-lp bg-lp-ground text-lp-text min-h-svh antialiased [color-scheme:light]`}
    >
      <SmoothScroll />
      <SiteHeader />

      <main>
        {/* Opening */}
        <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-5xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <Parallax distance={50} tilt={6} className="w-40 sm:w-52">
            <Image
              src="/brand/mascot/waving.webp"
              alt=""
              width={480}
              height={480}
              priority
              className="w-full select-none"
            />
          </Parallax>
          <h1 className="mt-6 text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance [font-stretch:112%] sm:text-6xl sm:[font-stretch:125%] lg:text-7xl">
            Every player has a story.
          </h1>
          <p className="text-lp-dim mt-6 max-w-xl text-lg leading-relaxed sm:text-xl">
            Howdi chat keeps it: their conversations, their visits, their progress. For gaming
            operators, store by store.
          </p>
          <div className="mt-9">{cta}</div>
        </section>

        <div id="story" className="border-lp-line scroll-mt-16 border-t">
          <Story art={art} />
        </div>

        {/* Closing */}
        <section className="border-lp-line bg-lp-sunk border-t">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:py-32">
            <Parallax distance={40} tilt={5} className="w-36 sm:w-44">
              <Image
                src="/brand/mascot/resting.webp"
                alt=""
                width={480}
                height={480}
                className="w-full select-none"
              />
            </Parallax>
            <h2 className="mt-6 text-4xl leading-[1.04] font-extrabold tracking-[-0.02em] text-balance [font-stretch:125%] sm:text-6xl">
              Say howdy to your players.
            </h2>
            <div className="mt-9">{cta}</div>
          </div>
        </section>

        {/* Questions */}
        <section id="questions" className="border-lp-line scroll-mt-16 border-t">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:px-8 lg:py-28">
            <h2 className="text-3xl leading-[1.08] font-extrabold tracking-[-0.015em] text-balance [font-stretch:118%] sm:text-4xl">
              Questions operators ask
            </h2>
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
      </main>

      <footer className="border-lp-line border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Logo tone="site" />
          <nav aria-label="Footer" className="text-lp-dim flex flex-wrap gap-x-6 gap-y-2">
            <a href="#story" className="hover:text-lp-text transition-colors">
              The story
            </a>
            <a href="#questions" className="hover:text-lp-text transition-colors">
              Questions
            </a>
            <Link href="/login" className="hover:text-lp-text transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-lp-text transition-colors">
              Create a player account
            </Link>
          </nav>
          <p className="text-lp-dim text-xs">© {new Date().getFullYear()} Howdi chat</p>
        </div>
      </footer>
    </div>
  );
}
