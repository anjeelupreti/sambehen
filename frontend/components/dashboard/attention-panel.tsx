import Link from 'next/link';
import { ChevronRightIcon, InboxIcon, MessageCircleReplyIcon, UserCheckIcon } from 'lucide-react';

import { formatCount } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  href: string;
  icon: 'approval' | 'reply' | 'unread';
}

const ICONS = {
  approval: UserCheckIcon,
  reply: MessageCircleReplyIcon,
  unread: InboxIcon,
} as const;

/**
 * The work waiting on the signed-in person, each row a link straight to it.
 * Rows with nothing waiting are dropped rather than shown as zeros, so the
 * panel only ever lists something to do.
 */
export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const waiting = items.filter((item) => item.count > 0);

  return (
    <section aria-labelledby="attention-title" className="bg-card flex flex-col rounded-xl border">
      <h2 id="attention-title" className="px-5 pt-5 text-base font-semibold">
        Needs attention
      </h2>

      {waiting.length === 0 ? (
        <p className="text-muted-foreground flex flex-1 items-center px-5 py-6 text-sm">
          You’re all caught up.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {waiting.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="hover:bg-accent focus-visible:bg-accent group flex items-center gap-3 px-5 py-3.5 text-sm transition-colors outline-none"
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-lg',
                      item.icon === 'approval'
                        ? 'bg-warning-surface text-warning'
                        : 'bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <span className="text-base font-semibold">{formatCount(item.count)}</span>
                  <ChevronRightIcon
                    className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
