import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRightIcon,
  BellDotIcon,
  ClipboardCheckIcon,
  HelpCircleIcon,
  HistoryIcon,
  MessagesSquareIcon,
  PaperclipIcon,
  RadioIcon,
  SearchIcon,
  SendHorizonalIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UserRoundCheckIcon,
  ZapIcon,
} from 'lucide-react';

import { ChatPreview } from '@/components/welcome/chat-preview';
import { InboxPreview } from '@/components/welcome/inbox-preview';
import { Reveal } from '@/components/welcome/reveal';
import { SecureRealms } from '@/components/welcome/secure-realms';
import { SiteNavbar } from '@/components/welcome/site-navbar';
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
  description:
    'Message your team directly. One thread, delivered live, with everything said kept in order.',
};

const PILLARS = [
  {
    icon: ZapIcon,
    title: 'Messages arrive, not refresh',
    body: 'An open connection delivers each message the moment it is sent. Nothing here waits for you to reload the page.',
  },
  {
    icon: UserRoundCheckIcon,
    title: 'Owned, not ticketed',
    body: 'Every account is assigned to a manager or store at approval. Your thread goes to the people responsible for it, not into a general pile.',
  },
  {
    icon: PaperclipIcon,
    title: 'Files in the thread',
    body: 'Images, PDFs and spreadsheets attach straight to a message and stay with it — no separate upload to chase.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Separate by design',
    body: 'Customer and team sign-ins are signed with different keys, so a session on one side is not a session on the other.',
  },
];

const STEPS = [
  {
    icon: UserPlusIcon,
    title: 'Create your account',
    body: 'Email, a username and a password. It takes about a minute.',
  },
  {
    icon: ClipboardCheckIcon,
    title: 'A team member picks it up',
    body: 'Every new account is reviewed and assigned to a manager or store, so there is someone responsible for it from day one.',
  },
  {
    icon: SendHorizonalIcon,
    title: 'Start the conversation',
    body: 'Sign in and open your thread. Everything you send and receive stays in one place.',
  },
];

const INBOX_DETAILS = [
  {
    icon: BellDotIcon,
    title: 'Unread counts that mean something',
    body: 'Anything you have not read is counted. Opening a thread clears it — nothing has to be marked by hand.',
  },
  {
    icon: SearchIcon,
    title: 'Search across people and messages',
    body: 'One field over the whole list, matching names and message text alike, so an old thread is a few letters away.',
  },
  {
    icon: RadioIcon,
    title: 'It tells you when it is not live',
    body: 'The connection state is shown rather than hidden. If the live link drops the page says so, instead of letting an empty thread read as silence.',
  },
];

const ATTACHMENTS = [
  { name: 'friday-summary.pdf', meta: 'PDF · from the team' },
  { name: 'receipt-scan.png', meta: 'Image · sent by you' },
  { name: 'entries-march.csv', meta: 'Spreadsheet · from the team' },
];

const FAQS = [
  {
    q: 'Who am I actually talking to?',
    a: 'The manager or store your account was assigned to when it was approved. Replies show as coming from "Team" rather than naming an individual — which of them typed it is internal, but the responsibility for your account is not shared out to a general queue, and it is not a bot.',
  },
  {
    q: 'Why does my account need approval before I can sign in?',
    a: 'Because the assignment happens then. A team member reviews the account and takes it on, which is what gives your messages someone to arrive with.',
  },
  {
    q: 'Are messages delivered live, or do I have to refresh?',
    a: 'Live. The app holds an authenticated connection open and messages appear as they are sent, on every device you have the page open on. If that connection drops, the page tells you rather than pretending.',
  },
  {
    q: 'Can I send files?',
    a: 'Yes — images, PDFs, documents, spreadsheets, CSVs and zip archives attach directly to a message and stay attached to it in the thread.',
  },
  {
    q: 'Is my conversation kept?',
    a: 'Every message is stored and the full history is there when you open the thread. Nothing is dropped after a period of silence.',
  },
  {
    q: 'Can staff read anyone they like?',
    a: 'No. Reach follows assignment: a team member sees the conversations belonging to the accounts in their own chain, and an internal message between two staff is visible to those two.',
  },
  {
    q: 'Can I change my own password?',
    a: 'No — credential and profile changes are made by your assigned team member on your behalf. That keeps a real person accountable for every change on your account. Message them and they will make it.',
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
 *
 * Every claim below describes something the signed-in product actually
 * does — live delivery, attachments, unread counts, per-realm keys. A
 * front door that promises a feature the app does not have is a bug that
 * only shows up after someone registers.
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
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:py-24 lg:px-8">
          <div className="animate-in fade-in slide-in-from-bottom-6 space-y-6 duration-700">
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              <MessagesSquareIcon className="size-3.5" />
              Real-time messaging
            </span>
            <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
              Talk to your team.
              <span className="text-primary"> Right here.</span>
            </h1>
            <p className="text-muted-foreground max-w-lg text-lg">
              Sambehen puts every conversation with the team that handles your account in one
              thread — delivered as it is sent, kept in order, and there whenever you open it.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/customer/register"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-md px-6 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              >
                Start messaging
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href="/customer/login"
                className="hover:bg-muted inline-flex h-11 items-center justify-center rounded-md border px-6 text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Open your inbox
              </Link>
            </div>
            <p className="text-muted-foreground text-sm">
              On the team?{' '}
              <Link
                href="/login"
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                Sign in here
              </Link>
              .
            </p>
          </div>

          <div className="animate-in fade-in zoom-in-95 duration-1000">
            <ChatPreview />
          </div>
        </section>

        {/* What the messaging actually gives you */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8 lg:py-24">
            {PILLARS.map(({ icon: Icon, title, body }, index) => (
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

        {/* The inbox */}
        <section className="bg-muted/30 border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <Reveal className="order-2 lg:order-1">
              <InboxPreview />
            </Reveal>

            <Reveal delay={150} className="order-1 lg:order-2">
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                <MessagesSquareIcon className="size-3.5" />
                For the team
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Every conversation in one list
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md">
                Customers get one thread with their team. On the other side, staff get all of theirs
                in a single searchable list — sorted by what came in last, so nothing sits unanswered
                because it scrolled out of sight.
              </p>

              <dl className="mt-6 space-y-4">
                {INBOX_DETAILS.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex gap-3">
                    <span className="bg-primary/10 text-primary mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <dt className="text-sm font-semibold">{title}</dt>
                      <dd className="text-muted-foreground text-sm">{body}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <Reveal className="mx-auto max-w-2xl space-y-3 text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Three steps to your first message
              </h2>
              <p className="text-muted-foreground">
                Register, get assigned, start talking.
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

        {/* Attachments and history */}
        <section className="bg-muted/30 border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <Reveal>
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                <HistoryIcon className="size-3.5" />
                Kept, not cleared
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                The whole thread, files and all
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md">
                Attach a screenshot, a PDF or a spreadsheet and it stays with the message you sent
                it on. Scroll back weeks later and the answer is still sitting where it was given.
              </p>
              <Link
                href="/customer/register"
                className="text-primary group mt-5 inline-flex items-center gap-1 text-sm font-semibold"
              >
                Open your first thread
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>

            <Reveal delay={150}>
              <div className="bg-card space-y-3 rounded-2xl border p-6 shadow-lg">
                {ATTACHMENTS.map(({ name, meta }) => (
                  <div
                    key={name}
                    className="hover:border-primary/40 flex items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-lg">
                      <PaperclipIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="text-muted-foreground truncate text-xs">{meta}</p>
                    </div>
                  </div>
                ))}
                <p className="text-muted-foreground border-t pt-4 text-xs">
                  Images, PDFs, documents, spreadsheets, CSVs and archives.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Who can see what */}
        <section className="border-t">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <Reveal className="order-2 lg:order-1">
              <SecureRealms />
            </Reveal>

            <Reveal delay={150} className="order-1 lg:order-2">
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                <ShieldCheckIcon className="size-3.5" />
                Who can see what
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Your thread is yours
              </h2>
              <p className="text-muted-foreground mt-3 max-w-md">
                Reach follows assignment, not seniority: a team member sees the conversations
                belonging to the accounts they are responsible for. The live connection is
                authenticated the same way every request is — an unidentified socket is closed, not
                left listening.
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

        {/* Closing CTA */}
        <section className="border-t">
          <Reveal className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-24">
            <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-2xl">
              <MessagesSquareIcon className="size-6" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Say the first thing.</h2>
            <p className="text-muted-foreground max-w-md">
              Registration takes a minute. A team member reviews every new account and takes it on
              before the first message lands.
            </p>
            <Link
              href="/customer/register"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-md px-6 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              Create your account
              <SendHorizonalIcon className="size-4" />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg">
                <MessagesSquareIcon className="size-4" />
              </div>
              <span className="font-bold tracking-tight">Sambehen</span>
            </div>
            <p className="text-muted-foreground max-w-xs text-sm">
              One thread with the team that handles your account.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold">Customers</p>
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
              Open your inbox
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
            <p className="text-muted-foreground flex items-start gap-1.5">
              <MessagesSquareIcon className="mt-0.5 size-4 shrink-0" />
              Message your team from your inbox once you are signed in.
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
