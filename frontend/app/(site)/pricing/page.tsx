import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckIcon } from 'lucide-react';

import { PageIntro, primaryButton, secondaryButton } from '@/components/landing/site-shell';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Howdi chat is priced per store, with every feature included.',
};

const INCLUDED = [
  'Accounts for every player and staff member',
  'Live chat with players and between staff',
  'Player records, visits and balances',
  'VIP tiers, milestones and referrals',
  'Broadcast email to players',
  'The player portal',
  'Import from spreadsheets, export any list',
  'Audit trail of every change',
];

const STEPS = [
  ['A short call', 'We learn how many stores you run and how your team is organised.'],
  [
    'Your chain, set up',
    'Managers and stores get their own sign-ins, and your players come in from a spreadsheet.',
  ],
  ['Live', 'Stores start recording visits and answering players.'],
];

export default function PricingPage() {
  return (
    <>
      <PageIntro
        title="Priced per store"
        body="One plan with everything in it. The price depends on how many stores you run, so it grows with your chain."
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16">
          <section className="border-lp-line bg-lp-raised rounded-3xl border p-8 shadow-[0_30px_70px_-40px_rgb(18_26_43/0.35)] sm:p-10">
            <h2 className="text-2xl font-extrabold [font-stretch:112%]">Howdi chat</h2>
            <p className="text-lp-dim mt-2">Every feature, for every store in your chain.</p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <CheckIcon
                    className="text-lp-ok mt-1 size-4 shrink-0"
                    strokeWidth={3}
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/contact" className={primaryButton}>
                Get a quote
              </Link>
              <Link href="/product" className={secondaryButton}>
                See the product
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-extrabold [font-stretch:112%]">
              How getting started works
            </h2>
            <ol className="mt-6 space-y-6">
              {STEPS.map(([title, body], index) => (
                <li key={title} className="flex gap-4">
                  <span className="bg-lp-primary grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-lp-dim mt-1 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
