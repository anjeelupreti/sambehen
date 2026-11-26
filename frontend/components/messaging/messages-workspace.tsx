'use client';

import { useCallback, useState } from 'react';

import { ExportButton } from '@/components/export-button';
import { MessagingView } from '@/components/messaging/messaging-view';
import { TeamMessagingView } from '@/components/messaging/team-messaging-view';
import type { Conversation } from '@/lib/types';
import { cn } from '@/lib/utils';

type Inbox = 'customers' | 'team';

/**
 * The full messages page: customer and team inboxes behind one switch.
 * Both stay mounted so each keeps its live unread count and open thread.
 */
export function MessagesWorkspace({
  initialConversations,
  viewer,
}: {
  initialConversations: Conversation[];
  viewer: { id: string; username: string; role: string };
}) {
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="bg-background flex items-center justify-between gap-3 border-b px-3 py-2 sm:px-4">
        <InboxSwitch value={inbox} onChange={setInbox} unread={unread} />
        {inbox === 'customers' && <ExportButton exportKey="conversations" />}
      </div>
      <div className={cn('min-h-0 flex-1', inbox !== 'customers' && 'hidden')}>
        <MessagingView
          initialConversations={initialConversations}
          viewer={viewer}
          onUnreadChange={setCustomersUnread}
        />
      </div>
      <div className={cn('min-h-0 flex-1', inbox !== 'team' && 'hidden')}>
        <TeamMessagingView viewer={viewer} onUnreadChange={setTeamUnread} />
      </div>
    </div>
  );
}

export function InboxSwitch({
  value,
  onChange,
  unread,
}: {
  value: Inbox;
  onChange: (value: Inbox) => void;
  unread: Record<Inbox, number>;
}) {
  return (
    <div role="tablist" aria-label="Inbox" className="bg-muted inline-flex rounded-full p-1">
      {(['customers', 'team'] as const).map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            'focus-visible:ring-ring/70 flex h-8 items-center gap-2 rounded-full px-3.5 text-sm font-medium outline-none focus-visible:ring-[3px]',
            value === key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {key === 'customers' ? 'Customers' : 'Team'}
          {unread[key] > 0 && (
            <span className="bg-primary text-primary-foreground grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
              {unread[key] > 99 ? '99+' : unread[key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
