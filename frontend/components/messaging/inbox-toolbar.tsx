'use client';

import { ArrowDownUpIcon, CheckIcon, SlidersHorizontalIcon } from 'lucide-react';

import type { InboxChip, InboxSort } from '@/app/(app)/messages/actions';
import type { Label } from '@/app/(app)/messages/label-actions';
import { LABEL_DOTS } from '@/components/chat/label-chips';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConversationSummary, Staff } from '@/lib/types';
import { cn } from '@/lib/utils';

const staffName = (staff: Staff) =>
  [staff.firstName, staff.lastName].filter(Boolean).join(' ') || staff.username;

export const SORTS: { value: InboxSort; label: string }[] = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'waiting', label: 'Longest waiting' },
  { value: 'recent', label: 'Newest activity' },
];

export interface InboxFilters {
  chip: InboxChip;
  sort: InboxSort;
  labelId: string;
  storeId: string;
  managerId: string;
}

/**
 * The inbox's controls under the search box: quick filter chips with live
 * counts, the sort, and a menu for labels and (for masters and managers)
 * which stores to look at.
 */
export function InboxToolbar({
  filters,
  onChange,
  summary,
  labels,
  scopes,
  onManageLabels,
}: {
  filters: InboxFilters;
  onChange: (next: Partial<InboxFilters>) => void;
  summary: ConversationSummary | null;
  labels: Label[];
  scopes: { managers: Staff[]; stores: Staff[] };
  /** Masters only. */
  onManageLabels?: () => void;
}) {
  const chips: { value: InboxChip; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: summary?.totalConversations },
    { value: 'unread', label: 'Unread', count: summary?.unreadConversations },
    { value: 'awaiting', label: 'Awaiting reply', count: summary?.awaitingReply },
    { value: 'vip', label: 'VIP', count: summary?.vipConversations },
    { value: 'new', label: 'New', count: summary?.newCustomerConversations },
    { value: 'big', label: 'Big spenders' },
  ];
  const label = labels.find((item) => item.id === filters.labelId);
  const store = scopes.stores.find((item) => item.id === filters.storeId);
  const manager = scopes.managers.find((item) => item.id === filters.managerId);
  const narrowing = [label?.name, manager?.username, store?.username].filter(Boolean);
  const sortLabel = SORTS.find((item) => item.value === filters.sort)?.label;

  return (
    <div className="space-y-2 border-b px-3 pb-2.5">
      <div
        role="toolbar"
        aria-label="Filter conversations"
        className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5"
      >
        {chips.map((chip) => {
          const active = filters.chip === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ chip: chip.value })}
              className={cn(
                'focus-visible:ring-ring/70 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-[3px]',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent text-foreground/80',
              )}
            >
              {chip.label}
              {chip.count !== undefined && (
                <span
                  className={cn(
                    'tabular-nums',
                    active ? 'text-primary-foreground/85' : 'text-muted-foreground',
                  )}
                >
                  {chip.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="hover:bg-accent focus-visible:ring-ring/70 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium outline-none focus-visible:ring-[3px]">
            <ArrowDownUpIcon className="text-muted-foreground size-3.5" />
            {sortLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.sort}
              onValueChange={(value) => onChange({ sort: value as InboxSort })}
            >
              {SORTS.map((sort) => (
                <DropdownMenuRadioItem key={sort.value} value={sort.value}>
                  {sort.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'focus-visible:ring-ring/70 ml-auto inline-flex h-8 max-w-[60%] items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium outline-none focus-visible:ring-[3px]',
              narrowing.length ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
            )}
          >
            <SlidersHorizontalIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {narrowing.length ? narrowing.join(', ') : 'Labels and stores'}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[60vh] w-60 overflow-y-auto">
            <DropdownMenuLabel>Label</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.labelId}
              onValueChange={(labelId) => onChange({ labelId })}
            >
              <DropdownMenuRadioItem value="">Any label</DropdownMenuRadioItem>
              {labels.map((item) => (
                <DropdownMenuRadioItem key={item.id} value={item.id}>
                  <span
                    className={cn('size-2 rounded-full', LABEL_DOTS[item.color] ?? LABEL_DOTS.gray)}
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {item.playerCount}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {onManageLabels && (
              <DropdownMenuItem onSelect={onManageLabels} className="text-primary">
                Manage labels
              </DropdownMenuItem>
            )}

            {scopes.managers.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Manager</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.managerId}
                  onValueChange={(managerId) => onChange({ managerId, storeId: '' })}
                >
                  <DropdownMenuRadioItem value="">All managers</DropdownMenuRadioItem>
                  {scopes.managers.map((item) => (
                    <DropdownMenuRadioItem key={item.id} value={item.id}>
                      {staffName(item)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
            {scopes.stores.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Store</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filters.storeId}
                  onValueChange={(storeId) => onChange({ storeId })}
                >
                  <DropdownMenuRadioItem value="">All stores</DropdownMenuRadioItem>
                  {scopes.stores
                    .filter((item) => !filters.managerId || item.parentId === filters.managerId)
                    .map((item) => (
                      <DropdownMenuRadioItem key={item.id} value={item.id}>
                        {staffName(item)}
                      </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
              </>
            )}
            {narrowing.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onChange({ labelId: '', storeId: '', managerId: '' })}
                >
                  <CheckIcon className="size-4" />
                  Clear
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
