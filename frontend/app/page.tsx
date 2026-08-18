import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  CrownIcon,
  GiftIcon,
  HeadsetIcon,
  HelpCircleIcon,
  MessageCircleIcon,
  PartyPopperIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingUpIcon,
  UserPlusIcon,
  ZapIcon,
} from 'lucide-react';

import { HeroIllustration } from '@/components/welcome/hero-illustration';
import { PayoutFlow } from '@/components/welcome/payout-flow';
import { Reveal } from '@/components/welcome/reveal';
import { SiteNavbar } from '@/components/welcome/site-navbar';
import { SpinWheel } from '@/components/welcome/spin-wheel';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { getAccessToken } from '@/lib/session';
import { getCustomerAccessToken } from '@/lib/customer-session';

export const metadata: Metadata = {
  title: 'Sambehen',
  description: 'Play, track and manage your account with a team that has your back.',
};

const TRUST_POINTS = [
  {
    icon: ShieldCheckIcon,
    title: 'Secure by default',
    body: 'Every account and transaction is protected and reviewed by a real team, not a black box.',
  },
  {
    icon: ZapIcon,
    title: 'Fast payouts',
    body: 'Balances and winnings are tracked in real time, with a clear history behind every figure.',
  },
  {
    icon: HeadsetIcon,
    title: 'A team, not a queue',
    body: 'Message your agent directly and hear back from a person who knows your account.',
  },
  {
    icon: SparklesIcon,
    title: 'Rewards that add up',
    body: 'Referral bonuses, VIP tiers and spin events reward the players who stick around.',
  },
];

const STEPS = [
  {
    icon: UserPlusIcon,
    title: 'Create your account',
    body: 'Enter your email, choose a username and password. Takes about a minute.',
  },
  {
    icon: ClipboardCheckIcon,
    title: 'A team member reviews it',
    body: 'Every new account is checked and assigned to a manager or store, so someone real is behind it from day one.',
  },
  {
    icon: RocketIcon,
    title: 'Sign in and get going',
    body: 'Track your balance, message your team, and start earning toward VIP rewards.',
  },
];

const FAQS = [
  {
    q: 'Why does my account need approval before I can sign in?',
    a: 'Every account is reviewed and assigned to a manager or store contact, so there is always a real person on our side responsible for it — not an automated signup with nobody behind it.',
  },
  {
    q: 'How long does approval usually take?',
    a: 'A team member reviews new accounts regularly. You will be able to sign in as soon as yours has been approved and assigned.',
  },
  {
    q: 'Can I change my own password?',
    a: 'No — credential and profile changes are made by your assigned team member on your behalf. This is deliberate: it keeps a real person accountable for every change on your account.',
  },
  {
    q: 'How do referral rewards work?',
    a: 'Once you are signed in, you can share your referral code or link. Bonus balance is credited when someone you referred joins and plays, tracked separately from your regular balance.',
  },
  {
    q: 'What if I have a question about my balance or a transaction?',
    a: 'Message your team directly from the customer portal once you are signed in. You are talking to the person who actually manages your account, not a queue.',
  },
  {
    q: 'How are spin event winners decided and recorded?',
    a: 'Staff run spin events and record every winner directly in the same system that tracks your balance — there is no separate, unaccountable prize list.',
  },
  {
    q: 'How do withdrawals work?',
    a: 'Request one once you are signed in. Your team processes it and the amount is deducted from your balance the moment it is recorded, with the transaction visible in your history immediately.',
  },
];

/**
 * The public front door.
 *
 * A signed-in visitor is sent straight past this to where they were
 * already going — staff to `/dashboard`, customers to `/customer` — so
 * this page is only ever seen by someone with no session at all. That is
 * also why it checks the *access* token rather than the actor cookie: the
 * actor cookie outlives the access token by design (see `/login`), and
 * keying on it here would land a stale session back on a marketing page
 * instead of asking them to sign back in.
 */
export default async function WelcomePage() {
  const [staffToken, customerToken] = await Promise.all([
    getAccessToken(),
    getCustomerAccessToken(),
  ]);

  if (staffToken) redirect('/dashboard');
  if (customerToken) redirect('/customer');

  return (
    <div className="flex min-h-svh flex-col">
      <SiteNavbar />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:py-24 lg:px-8">
          <div className="animate-in fade-in slide-in-from-bottom-6 space-y-6 duration-700">
            <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              Now accepting new players
            </span>
            <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
              Games worth trusting, backed by a team that shows up.
            </h1>
            <p className="text-muted-foreground max-w-lg text-lg">
              Sambehen keeps your account, your balance and your wins in one place — managed by a
              real team, visible to you at every step.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/customer/register"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Create your account
              </Link>
              <Link
                href="/customer/login"
                className="hover:bg-muted inline-flex h-11 items-center justify-center rounded-md border px-6 text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="animate-in fade-in zoom-in-95 duration-1000">
            <HeroIllustration />
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8 lg:py-24">
            {TRUST_POINTS.map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={index * 100}>
                <div className="group space-y-3 rounded-xl p-2 transition-all hover:-translate-y-1">
                  <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-10 items-center justify-center rounded-lg transition-colors duration-300">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground text-sm">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-muted/30 border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <Reveal className="mx-auto max-w-2xl space-y-3 text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
              <p className="text-muted-foreground">
                Three steps between here and your first sign-in.
              </p>
            </Reveal>

            <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
              <div
                aria-hidden
                className="bg-border absolute top-6 right-[16.5%] left-[16.5%] hidden h-px sm:block"
              />
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <Reveal key={title} delay={index * 150}>
                  <div className="relative flex flex-col items-center gap-3 text-center">
                    <div className="bg-primary text-primary-foreground relative z-10 flex size-12 items-center justify-center rounded-full text-sm font-bold shadow-sm">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-muted-foreground max-w-xs text-sm">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Feature spotlight: balance & activity */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <Reveal>
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                <TrendingUpIcon className="size-3.5" />
                Live tracking
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                See exactly where you stand
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md">
                Every transaction is logged the moment it happens. Your balance, your history and
                your activity trend are always one sign-in away — no waiting for a statement.
              </p>
            </Reveal>

            <Reveal delay={150}>
              <div className="group bg-card rounded-2xl border p-6 shadow-lg transition-transform duration-500 hover:-rotate-1 hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium uppercase">
                    Balance
                  </span>
                  <span className="text-debit text-xs font-medium">+ this month</span>
                </div>
                <p className="mt-1 text-3xl font-bold tabular-nums">$4,820.00</p>
                <div className="mt-6 flex h-24 items-end gap-1.5">
                  {[40, 55, 35, 70, 50, 85, 65, 90, 60, 100, 75, 95].map((height, index) => (
                    <div
                      key={index}
                      style={{ height: `${height}%`, transitionDelay: `${index * 30}ms` }}
                      className="bg-primary/70 group-hover:bg-primary flex-1 origin-bottom rounded-t-sm transition-all duration-300 ease-out group-hover:scale-y-110"
                    />
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Feature spotlight: VIP tiers */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <Reveal className="order-2 lg:order-1">
              <div className="bg-card space-y-3 rounded-2xl border p-6 shadow-lg transition-transform duration-500 hover:rotate-1 hover:scale-[1.02]">
                {[
                  { tier: 3, label: 'Platinum', active: false },
                  { tier: 2, label: 'Gold', active: true },
                  { tier: 1, label: 'Silver', active: false },
                ].map(({ tier, label, active }) => (
                  <div
                    key={tier}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      active ? 'border-primary bg-primary/5' : 'border-transparent'
                    }`}
                  >
                    <div
                      className={`flex size-9 items-center justify-center rounded-full ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <CrownIcon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-muted-foreground text-xs">Tier {tier}</p>
                    </div>
                    {active ? (
                      <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        Current
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={150} className="order-1 lg:order-2">
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                <GiftIcon className="size-3.5" />
                Rewards
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Climb the VIP ladder
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md">
                VIP tiers and referral bonuses reward players who stick around — tracked
                automatically from your real activity, visible to you the whole way up.
              </p>
              <Link
                href="/customer/register"
                className="text-primary group mt-4 inline-flex items-center gap-1 text-sm font-semibold"
              >
                Start earning toward yours
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* Feature spotlight: spin events */}
        <section className="bg-muted/30 border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <Reveal>
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                <CalendarClockIcon className="size-3.5" />
                Spin events
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Spin events, run out in the open
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md">
                Staff schedule spin events and record every winner in the same ledger as everything
                else — nothing about who won or when is hand-waved after the fact.
              </p>
              <div className="text-muted-foreground mt-4 flex items-center gap-1.5 text-sm">
                <PartyPopperIcon className="size-4" />
                Winners are recorded, not just announced
              </div>
            </Reveal>

            <Reveal delay={150}>
              <SpinWheel />
            </Reveal>
          </div>
        </section>

        {/* Feature spotlight: withdrawals */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <Reveal className="order-2 lg:order-1">
              <PayoutFlow />
            </Reveal>

            <Reveal delay={150} className="order-1 lg:order-2">
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                <BadgeCheckIcon className="size-3.5" />
                Withdrawals
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Request a withdrawal, watch it move
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md">
                A withdrawal request goes to your team, gets processed, and lands back in your
                balance — every stage logged in the same ledger you can see, not a black box.
              </p>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-muted/30 border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <Reveal className="mx-auto max-w-2xl space-y-3 text-center">
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                <HelpCircleIcon className="size-3.5" />
                Questions
              </span>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Frequently asked questions
              </h2>
            </Reveal>

            <Reveal delay={150} className="mx-auto mt-8 max-w-2xl">
              <Accordion type="single" collapsible className="bg-card rounded-xl border px-6">
                {FAQS.map(({ q, a }) => (
                  <AccordionItem key={q} value={q}>
                    <AccordionTrigger>{q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        <section className="border-t">
          <Reveal className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-24">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to get started?</h2>
            <p className="text-muted-foreground max-w-md">
              Registration takes a minute. A team member reviews every new account before it goes
              live.
            </p>
            <Link
              href="/customer/register"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              Create your account
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-base font-bold">
                S
              </div>
              <span className="font-bold tracking-tight">Sambehen</span>
            </div>
            <p className="text-muted-foreground max-w-xs text-sm">
              Games worth trusting, backed by a team that shows up.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold">Players</p>
            <Link
              href="/customer/register"
              className="text-muted-foreground hover:text-foreground block transition-colors"
            >
              Create an account
            </Link>
            <Link
              href="/customer/login"
              className="text-muted-foreground hover:text-foreground block transition-colors"
            >
              Customer sign in
            </Link>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold">Team</p>
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground block transition-colors"
            >
              Staff sign in
            </Link>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold">Get in touch</p>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <MessageCircleIcon className="size-4" />
              Message your team once signed in
            </p>
          </div>
        </div>

        <div className="border-t px-4 py-6 text-center sm:px-6">
          <span className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Sambehen.
          </span>
        </div>
      </footer>
    </div>
  );
}
