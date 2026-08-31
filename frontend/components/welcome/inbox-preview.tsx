import { RadioIcon, SearchIcon } from 'lucide-react';

/**
 * The team's side of the same conversation.
 *
 * This is the staff inbox, not the customer's — a customer has one thread
 * with the team, while a team member has a searchable list of the people
 * they are responsible for. The page says so where it uses this, because a
 * list of names shown as "your inbox" would promise customers a view the
 * product does not give them.
 */
const THREADS = [
  {
    initials: 'PR',
    name: 'priya.r',
    preview: 'Got it, that matches. Appreciate the quick reply.',
    at: '09:43',
    unread: 2,
    awaiting: true,
  },
  {
    initials: 'JM',
    name: 'j.mensah',
    preview: 'Sounds good — I will check back on Thursday.',
    at: '08:15',
    unread: 0,
    awaiting: false,
  },
  {
    initials: 'AT',
    name: 'a.torres',
    preview: 'Both entries from Friday are recorded.',
    at: 'Tue',
    unread: 0,
    awaiting: false,
  },
  {
    initials: 'LK',
    name: 'l.kaur',
    preview: 'Thanks for sending the scan across.',
    at: 'Mon',
    unread: 0,
    awaiting: false,
  },
];

export function InboxPreview() {
  return (
    <div className="bg-card overflow-hidden rounded-2xl border shadow-lg" aria-hidden>
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Messages</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <RadioIcon className="size-3 text-green-600 dark:text-green-500" />
            Live
          </span>
        </div>
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <div className="text-muted-foreground bg-muted/40 rounded-md border py-1.5 pl-8 text-xs">
            Search people or messages…
          </div>
        </div>
      </div>

      <ul className="divide-y">
        {THREADS.map((thread) => (
          <li
            key={thread.name}
            className="hover:bg-accent/50 flex items-start gap-2.5 px-3 py-2.5 transition-colors"
          >
            <span className="bg-muted text-muted-foreground mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold">
              {thread.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{thread.name}</span>
                <span className="text-muted-foreground shrink-0 text-[10px]">{thread.at}</span>
              </div>
              <p className="text-muted-foreground truncate text-xs">{thread.preview}</p>
              {thread.awaiting ? (
                <span className="text-muted-foreground mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px]">
                  awaiting reply
                </span>
              ) : null}
            </div>
            {thread.unread > 0 ? (
              <span className="bg-primary text-primary-foreground mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums">
                {thread.unread}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
