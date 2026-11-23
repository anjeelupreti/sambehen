import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { formatCount, formatDate } from '@/lib/money';
import type { Message } from '@/lib/types';

/** The newest message in the player's thread, and the way to reply. */
export function LatestMessage({ message, unread }: { message: Message | null; unread: number }) {
  return (
    <section
      aria-labelledby="messages-title"
      className="bg-card flex flex-col rounded-2xl border p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="messages-title" className="text-base font-semibold">
          Messages
        </h2>
        {unread > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
            {formatCount(unread)} new
          </span>
        )}
      </div>

      {message ? (
        <figure className="bg-muted mt-4 rounded-lg p-4">
          <figcaption className="text-muted-foreground flex justify-between gap-3 text-xs">
            <span>{message.senderType === 'customer' ? 'You' : 'Your team'}</span>
            <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
          </figcaption>
          <blockquote className="mt-2 line-clamp-3 text-sm leading-relaxed">
            {message.body || 'Sent an attachment'}
          </blockquote>
        </figure>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">No messages yet.</p>
      )}

      <div className="mt-auto pt-5">
        <Button asChild className="w-full sm:w-fit" variant={unread > 0 ? 'default' : 'outline'}>
          <Link href="/customer/messages">{message ? 'Open messages' : 'Message your team'}</Link>
        </Button>
      </div>
    </section>
  );
}
