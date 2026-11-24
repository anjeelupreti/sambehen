import type { Metadata } from 'next';

import { Prose } from '@/components/landing/prose';
import { COMPANY, PageIntro } from '@/components/landing/site-shell';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How Howdi chat protects operator and player data: access by store, sign-in, the audit trail and where data is kept.',
};

const SECTIONS = [
  {
    title: 'Each store sees only its own players',
    body: [
      'Access follows the chain: the master sees every store, a manager sees their own stores, and a store sees only its players. The server checks this on every request, including searches, exports, file downloads and live messages, so a link or a guessed address never reaches another store’s data.',
    ],
  },
  {
    title: 'Staff and players sign in separately',
    body: [
      'Staff and players use different signing keys, so a player’s session can never act as staff, or the other way round.',
      'Sessions use short-lived access tokens (15 minutes for staff, 30 for players) kept in cookies that page scripts cannot read, and refresh tokens that are revoked on sign-out.',
    ],
  },
  {
    title: 'Passwords and sign-in',
    body: [
      'Passwords are hashed with Argon2 and never stored or logged in plain text. Sign-in attempts are rate-limited, and the sign-in page answers the same way whether or not an account exists, so it can’t be used to find out who has one.',
    ],
  },
  {
    title: 'Every change is on record',
    body: [
      'The audit trail keeps who changed what and when, with the values before and after. Players are suspended rather than deleted, so their history stays intact.',
    ],
  },
  {
    title: 'Money is exact',
    body: [
      'Amounts are stored as exact decimals to the cent and totalled in the database. Nothing is rounded along the way, and corrections are recorded as their own entries rather than edits.',
    ],
  },
  {
    title: 'Where data is kept',
    body: [
      'The application and its database run in the United States (US East) on Railway. Files attached to messages are stored on Cloudflare R2, which encrypts them at rest. Email is sent through Resend. Every connection, including live chat, uses HTTPS.',
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageIntro
        title="Security"
        body="How Howdi chat protects operator and player data, as the product works today."
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-x-16 gap-y-14 md:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title} className="border-lp-line-strong border-t pt-6">
              <h2 className="text-2xl leading-tight font-extrabold [font-stretch:112%]">
                {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-lp-dim mt-4 max-w-[60ch] leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="bg-lp-sunk mt-20 rounded-2xl p-8 sm:p-10">
          <Prose>
            <h2>Reporting a security issue</h2>
            <p>
              If you think you’ve found a vulnerability, email{' '}
              <a href={`mailto:${COMPANY.salesEmail}?subject=Security%20report`}>
                {COMPANY.salesEmail}
              </a>{' '}
              with “Security report” in the subject. Include what you found and how to reproduce it,
              and please give us a chance to fix it before sharing it publicly.
            </p>
          </Prose>
        </div>
      </div>
    </>
  );
}
