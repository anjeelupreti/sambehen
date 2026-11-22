'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import {
  CAMPAIGN,
  CUSTOMERS,
  REWARD_EVENT,
  INBOX,
  REFERRALS,
  REFERRAL_PROGRAM,
  TRANSACTIONS,
  VIP_CRITERIA,
  formatMoney,
  type PlayerStatus,
  type ReferralStatus,
} from './landing-data';
import { Frame } from './product-frame';
import { cn } from '@/lib/utils';

interface Module {
  id: string;
  label: string;
  title: string;
  body: string;
  view: ReactNode;
}

const MODULES: Module[] = [
  {
    id: 'customers',
    label: 'Players',
    title: 'Every player, with an owner',
    body: 'Each player belongs to a store or manager. Import a spreadsheet, review the rows, then commit only the ones you keep.',
    view: <CustomersView />,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    title: 'A ledger that explains itself',
    body: 'Debits and credits post to the balance in the same step. A correction is tied to the entry it fixes, so withdrawals stay honest.',
    view: <TransactionsView />,
  },
  {
    id: 'vip',
    label: 'VIP and rewards',
    title: 'Tiers from real spend',
    body: 'Set a spend target for a period. Players qualify as transactions land, and rewards only go to players who qualified.',
    view: <VipView />,
  },
  {
    id: 'referrals',
    label: 'Referrals',
    title: 'Bonuses that pay themselves',
    body: 'Issue codes to chosen players. When a referred player spends enough, both bonuses post to a separate ledger.',
    view: <ReferralsView />,
  },
  {
    id: 'broadcasts',
    label: 'Broadcasts',
    title: 'Email the right players',
    body: 'Filter by activity, tier or store and see the audience count before anything sends.',
    view: <BroadcastView />,
  },
  {
    id: 'messaging',
    label: 'Messaging',
    title: 'One inbox for every thread',
    body: 'Players and staff message live, with attachments. Unread counts clear when a thread is opened.',
    view: <InboxView />,
  },
];

export function PlatformTour() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const next = (index + MODULES.length) % MODULES.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      select(active + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(active - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      select(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      select(MODULES.length - 1);
    }
  };

  const current = MODULES[active];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12">
      <div
        role="tablist"
        aria-label="Platform modules"
        aria-orientation="vertical"
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {MODULES.map((module, index) => (
          <button
            key={module.id}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            role="tab"
            id={`tab-${module.id}`}
            aria-selected={index === active}
            aria-controls={`panel-${module.id}`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={onKeyDown}
            className={cn(
              'focus-visible:outline-lp-primary shrink-0 rounded-lg px-4 py-3 text-left text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
              index === active ? 'bg-lp-raised text-lp-text' : 'text-lp-dim hover:text-lp-text',
            )}
          >
            {module.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${current.id}`}
        aria-labelledby={`tab-${current.id}`}
        tabIndex={0}
        className="focus-visible:outline-lp-primary grid min-w-0 gap-6 rounded-lg focus-visible:outline-2 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:gap-10"
      >
        <div className="max-w-md">
          <h3 className="text-xl font-semibold [font-stretch:112%]">{current.title}</h3>
          <p className="text-lp-dim mt-3 leading-relaxed">{current.body}</p>
        </div>
        <div className="min-w-0">{current.view}</div>
      </div>
    </div>
  );
}

/* ── Product views ─────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<PlayerStatus, string> = {
  active: 'text-lp-ok bg-lp-ok/10',
  inactive: 'text-lp-dim bg-lp-line/60',
  suspended: 'text-lp-stop bg-lp-stop/10',
  pending: 'text-lp-chip-text bg-lp-chip/10',
};

function Status({ value }: { value: PlayerStatus }) {
  return (
    <span
      className={cn('rounded-md px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLE[value])}
    >
      {value}
    </span>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <table className="w-full min-w-[30rem] text-sm">
      <thead>
        <tr className="text-lp-dim text-left text-xs">
          {head.map((cell, index) => (
            <th
              key={cell}
              scope="col"
              className={cn('px-4 py-2.5 font-medium', index === head.length - 1 && 'text-right')}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-lp-line divide-y [&_td]:px-4 [&_td]:py-2.5">{children}</tbody>
    </table>
  );
}

function CustomersView() {
  return (
    <Frame title="Players" action="Import spreadsheet">
      <Table head={['Name', 'Store', 'Status', 'Balance']}>
        {CUSTOMERS.map((player) => (
          <tr key={player.name}>
            <td className="font-medium">{player.name}</td>
            <td className="text-lp-dim">{player.store}</td>
            <td>
              <Status value={player.status} />
            </td>
            <td className="tabular text-right">{formatMoney(player.balance)}</td>
          </tr>
        ))}
      </Table>
    </Frame>
  );
}

function TransactionsView() {
  return (
    <Frame title="Transactions" action="Export">
      <Table head={['Entry', 'Player', 'Game', 'Amount']}>
        {TRANSACTIONS.map((entry) => (
          <tr key={entry.id}>
            <td>
              <span className="tabular">{entry.id}</span>
              {entry.correctionOf && (
                <span className="text-lp-dim block text-xs">Corrects {entry.correctionOf}</span>
              )}
            </td>
            <td>{entry.player}</td>
            <td className="text-lp-dim">{entry.game}</td>
            <td
              className={cn(
                'tabular text-right font-medium',
                entry.type === 'debit' ? 'text-lp-signal' : 'text-lp-text',
              )}
            >
              {entry.type === 'debit' ? '+' : '−'}
              {formatMoney(entry.amount)}
            </td>
          </tr>
        ))}
      </Table>
    </Frame>
  );
}

function VipView() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Frame title="VIP criteria">
        <ul className="divide-lp-line divide-y">
          {VIP_CRITERIA.map((criteria) => (
            <li key={criteria.tier} className="flex items-baseline justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-lp-chip-text text-sm font-semibold">{criteria.tier}</p>
                <p className="text-lp-dim text-xs">{criteria.rule}</p>
              </div>
              <p className="tabular text-sm whitespace-nowrap">
                {criteria.qualified} <span className="text-lp-dim">qualified</span>
              </p>
            </li>
          ))}
        </ul>
      </Frame>
      <Frame title={REWARD_EVENT.name}>
        <div className="px-4 py-3">
          <p className="text-lp-dim text-xs">Reward pool</p>
          <p className="text-lp-chip-text tabular text-2xl font-semibold [font-stretch:112%]">
            {formatMoney(REWARD_EVENT.pool)}
          </p>
          <p className="text-lp-dim mt-1 text-xs">{REWARD_EVENT.eligible} Gold players eligible</p>
        </div>
        <ul className="divide-lp-line border-lp-line divide-y border-t">
          {REWARD_EVENT.recipients.map((recipient) => (
            <li key={recipient.name} className="flex justify-between px-4 py-2 text-sm">
              <span>{recipient.name}</span>
              <span className="tabular">{formatMoney(recipient.amount)}</span>
            </li>
          ))}
        </ul>
      </Frame>
    </div>
  );
}

const REFERRAL_STYLE: Record<ReferralStatus, string> = {
  pending: 'text-lp-dim bg-lp-line/60',
  qualified: 'text-lp-signal bg-lp-signal/10',
  rewarded: 'text-lp-ok bg-lp-ok/10',
};

function ReferralsView() {
  return (
    <Frame title={`${REFERRAL_PROGRAM.name} program`}>
      <p className="text-lp-dim border-lp-line border-b px-4 py-3 text-xs">
        {formatMoney(REFERRAL_PROGRAM.referrer)} to the referrer and{' '}
        {formatMoney(REFERRAL_PROGRAM.referee)} to the new player, once they spend{' '}
        {formatMoney(REFERRAL_PROGRAM.minSpend)}.
      </p>
      <Table head={['Referrer', 'New player', 'Spent', 'Status']}>
        {REFERRALS.map((referral) => (
          <tr key={referral.referee}>
            <td>{referral.referrer}</td>
            <td>{referral.referee}</td>
            <td className="tabular">{formatMoney(referral.spent)}</td>
            <td className="text-right">
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-medium capitalize',
                  REFERRAL_STYLE[referral.status],
                )}
              >
                {referral.status}
              </span>
            </td>
          </tr>
        ))}
      </Table>
    </Frame>
  );
}

function BroadcastView() {
  return (
    <Frame title="New campaign">
      <div className="space-y-4 p-4">
        <div>
          <p className="text-lp-dim text-xs">Subject</p>
          <p className="border-lp-line bg-lp-sunk mt-1 rounded-md border px-3 py-2 text-sm">
            {CAMPAIGN.subject}
          </p>
        </div>
        <div>
          <p className="text-lp-dim text-xs">Audience</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CAMPAIGN.filters.map((filter) => (
              <span
                key={filter}
                className="border-lp-line-strong rounded-md border px-2.5 py-1 text-xs"
              >
                {filter}
              </span>
            ))}
          </div>
        </div>
        <div className="border-lp-line flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm">
            <span className="tabular text-lg font-semibold">{CAMPAIGN.audience}</span>{' '}
            <span className="text-lp-dim">players will receive this</span>
          </p>
          <span className="bg-lp-primary text-white rounded-md px-3 py-1.5 text-xs font-semibold">
            Send campaign
          </span>
        </div>
      </div>
    </Frame>
  );
}

function InboxView() {
  return (
    <Frame title="Messages" action="Live">
      <ul className="divide-lp-line divide-y">
        {INBOX.map((thread) => (
          <li key={thread.name} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{thread.name}</span>
                {thread.staff && <span className="text-lp-dim text-xs font-normal">Staff</span>}
              </p>
              <p className="text-lp-dim truncate text-xs">{thread.preview}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-lp-dim tabular text-xs">{thread.when}</span>
              {thread.unread > 0 && (
                <span className="bg-lp-signal text-white tabular grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold">
                  {thread.unread}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
