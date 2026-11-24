import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Prose } from '@/components/landing/prose';
import { COMPANY, PageIntro, primaryButton } from '@/components/landing/site-shell';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Howdi builds Howdi chat for gaming operators who run more than one store. Based in Texas.',
};

export default function AboutPage() {
  return (
    <>
      <PageIntro
        title="About Howdi"
        body="We build Howdi chat for gaming operators who run more than one store."
      />
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-20 lg:px-8 lg:py-24">
        <Prose>
          <h2>Why we built it</h2>
          <p>
            Running players across several stores often means a patchwork: a spreadsheet for
            balances, a phone full of texts, and one manager who knows which store has which player.
            It works until someone asks a question nobody can answer.
          </p>
          <p>
            {COMPANY.product} puts each player’s conversations, visits and progress in one place,
            and gives every store exactly its own share of it.
          </p>

          <h2>What we believe</h2>
          <ul>
            <li>
              <strong>Players are people, not tickets.</strong> They should get an answer from the
              store that knows them, while they’re still there.
            </li>
            <li>
              <strong>Loyalty, not pressure.</strong> We reward showing up and bringing friends. We
              don’t build features that push anyone to spend more.
            </li>
            <li>
              <strong>Operators own their data.</strong> Every list exports, and nothing is shared
              outside the chain it belongs to.
            </li>
          </ul>

          <h2>Where we are</h2>
          <p>
            {COMPANY.name} is based in {COMPANY.location}. Reach us at{' '}
            <a href={`mailto:${COMPANY.salesEmail}`}>{COMPANY.salesEmail}</a>.
          </p>
        </Prose>

        <aside className="flex flex-col items-center gap-8 lg:items-start">
          <Image
            src="/brand/logo-3d.png"
            alt=""
            width={720}
            height={763}
            className="w-56 select-none lg:w-72"
          />
          <Link href="/contact" className={primaryButton}>
            Talk to us
          </Link>
        </aside>
      </div>
    </>
  );
}
