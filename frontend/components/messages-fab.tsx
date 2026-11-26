'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Maximize2Icon, MessageSquareIcon, XIcon } from 'lucide-react';

import { InboxSwitch } from '@/components/messaging/messages-workspace';
import { MessagingView } from '@/components/messaging/messaging-view';
import { TeamMessagingView } from '@/components/messaging/team-messaging-view';
import { cn } from '@/lib/utils';

type Inbox = 'customers' | 'team';

/**
 * The chat bubble: both inboxes in a small panel, for answering without
 * leaving the page. Hidden on /messages, which already shows everything.
 * The views stay mounted while the panel is closed so the badge stays live.
 */
export function MessagesFab({
  viewer,
}: {
  viewer: { id: string; username: string; role: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<Inbox>('customers');
  const [unread, setUnread] = useState<Record<Inbox, number>>({ customers: 0, team: 0 });
  const setCustomersUnread = useCallback(
    (count: number) =>
      setUnread((current) =>
        current.customers === count ? current : { ...current, customers: count },
      ),
    [],
  );
  const setTeamUnread = useCallback(
    (count: number) =>
      setUnread((current) => (current.team === count ? current : { ...current, team: count })),
    [],
  );

  const onMessagesPage = pathname.startsWith('/messages');
  const total = unread.customers + unread.team;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (onMessagesPage) return null;

  return (
    <>
      <div
        role="dialog"
        aria-label="Messages"
        aria-hidden={!open}
        className={cn(
          'bg-background fixed z-50 flex flex-col overflow-hidden',
          'inset-0 sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(620px,calc(100svh-8rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:shadow-xl',
          !open && 'hidden',
        )}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <InboxSwitch value={inbox} onChange={setInbox} unread={unread} />
          <div className="ml-auto flex items-center">
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              aria-label="Open full messages"
              className="hover:bg-accent focus-visible:ring-ring/70 grid size-9 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
            >
              <Maximize2Icon className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close messages"
              className="hover:bg-accent focus-visible:ring-ring/70 grid size-9 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>
        <div className={cn('flex min-h-0 flex-1 flex-col', inbox !== 'customers' && 'hidden')}>
          <MessagingView viewer={viewer} compact onUnreadChange={setCustomersUnread} />
        </div>
        <div className={cn('flex min-h-0 flex-1 flex-col', inbox !== 'team' && 'hidden')}>
          <TeamMessagingView viewer={viewer} compact onUnreadChange={setTeamUnread} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={total > 0 ? `Messages, ${total} unread` : 'Messages'}
        aria-expanded={open}
        className={cn(
          'bg-primary text-primary-foreground focus-visible:ring-ring/70 fixed right-6 bottom-6 z-50 grid size-14 place-items-center rounded-full shadow-lg outline-none transition-transform hover:scale-105 focus-visible:ring-[3px]',
          open && 'max-sm:hidden',
        )}
      >
        {open ? <XIcon className="size-6" /> : <MessageSquareIcon className="size-6" />}
        {total > 0 && !open && (
          <span className="bg-destructive ring-background absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold text-white tabular-nums ring-2">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
    </>
  );
}
