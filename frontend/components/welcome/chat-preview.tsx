'use client';

import { useEffect, useState } from 'react';
import { FileTextIcon, PaperclipIcon, RadioIcon, SendHorizonalIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ScriptedMessage {
  from: 'team' | 'you';
  body: string;
  at: string;
  attachment?: string;
}

/**
 * A short, honest exchange.
 *
 * The team side is labelled "Team", not a person's name, because that is
 * what a customer actually sees: the gateway strips internal staff
 * attribution before a message reaches the customer realm. A hero that
 * showed a named agent would be advertising something the product
 * deliberately does not do.
 */
const SCRIPT: ScriptedMessage[] = [
  {
    from: 'team',
    body: 'Your account is approved and assigned. Anything you need, this is the place.',
    at: '09:41',
  },
  { from: 'you', body: 'Thanks! Can I check what was recorded on Friday?', at: '09:42' },
  {
    from: 'team',
    body: "It's all in your history — sending the summary across now.",
    at: '09:42',
    attachment: 'friday-summary.pdf',
  },
  { from: 'you', body: 'Got it, that matches. Appreciate the quick reply.', at: '09:43' },
];

const STEP_MS = 1400;
const HOLD_MS = 3200;

/**
 * The hero: the customer's own thread, replaying one conversation on a loop.
 *
 * The loop is the point — a static screenshot cannot show that messages
 * arrive rather than being fetched, which is the one thing this page is
 * actually about. It reveals messages on a timer and then holds the
 * finished thread long enough to read before starting over.
 */
export function ChatPreview() {
  // Starts empty so the thread fills in on arrival. Rendering it complete
  // and then clearing it would flash the finished conversation for a frame
  // before the loop began.
  const [shown, setShown] = useState(0);

  useEffect(() => {
    // Someone who has asked the OS for less movement gets the finished
    // thread in one go rather than a paused animation — same information,
    // no motion.
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      setShown(SCRIPT.length);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const advance = (next: number) => {
      setShown(next);
      timer = setTimeout(
        () => advance(next >= SCRIPT.length ? 0 : next + 1),
        next >= SCRIPT.length ? HOLD_MS : STEP_MS,
      );
    };

    timer = setTimeout(() => advance(1), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Ambient wash behind the window. Decorative only. */}
      <div
        aria-hidden
        className="bg-primary/20 animate-blob absolute -top-10 -left-10 size-56 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob absolute -right-8 -bottom-10 size-56 rounded-full bg-sky-400/20 blur-3xl [animation-delay:3s]"
      />

      <div className="bg-card relative overflow-hidden rounded-2xl border shadow-2xl">
        {/* The same header the real thread carries: who it is with, and
            whether the live connection is actually up. */}
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <span className="text-sm font-medium">Messages with the team</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <RadioIcon className="size-3 text-green-600 dark:text-green-500" />
            Live
          </span>
        </header>

        <div className="bg-muted/20 flex h-80 flex-col justify-end gap-2.5 overflow-hidden p-4">
          {SCRIPT.map((message, index) => (
            <Bubble key={index} message={message} visible={index < shown} />
          ))}
        </div>

        {/* A composer, drawn not wired: the real one lives behind sign-in. */}
        <div aria-hidden className="flex items-center gap-2 border-t px-3 py-2.5">
          <PaperclipIcon className="text-muted-foreground size-4 shrink-0" />
          <div className="text-muted-foreground bg-muted/50 flex-1 rounded-full px-3 py-1.5 text-xs">
            Write a message…
          </div>
          <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full">
            <SendHorizonalIcon className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message, visible }: { message: ScriptedMessage; visible: boolean }) {
  const mine = message.from === 'you';

  return (
    <div
      className={cn(
        'flex transition-all duration-500 ease-out',
        mine ? 'justify-end' : 'justify-start',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] space-y-1.5 rounded-2xl px-3 py-2 text-sm shadow-sm',
          mine
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-card rounded-bl-sm border',
        )}
      >
        <p className="leading-snug">{message.body}</p>

        {message.attachment ? (
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
              mine ? 'bg-primary-foreground/15' : 'bg-muted',
            )}
          >
            <FileTextIcon className="size-3.5 shrink-0" />
            <span className="truncate">{message.attachment}</span>
          </span>
        ) : null}

        <p
          className={cn(
            'text-[10px]',
            mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          {mine ? 'You' : 'Team'} · {message.at}
        </p>
      </div>
    </div>
  );
}
