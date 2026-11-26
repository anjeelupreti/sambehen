'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLinkIcon, XIcon } from 'lucide-react';

import { getPlayer, setPlayerLabels, type Label } from '@/app/(app)/messages/label-actions';
import { toast } from 'sonner';
import { ChatAvatar } from '@/components/chat/avatar';
import { LabelChips, type ChipLabel } from '@/components/chat/label-chips';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatMoney } from '@/lib/money';
import { CUSTOMER_STATUS_VARIANT } from '@/lib/status';
import type { Customer } from '@/lib/types';
import { LabelPicker } from './label-picker';

/**
 * The player behind the open conversation: who they are, their labels
 * (editable here), and the figures staff most often need mid-chat, so a
 * question like "how much did they put in?" never means leaving the thread.
 */
export function PlayerPanel({
  customerId,
  labels,
  onLabelsChange,
  onManageLabels,
  onClose,
}: {
  customerId: string;
  labels: Label[];
  /** Tells the inbox list, so its row shows the new labels too. */
  onLabelsChange: (customerId: string, labels: ChipLabel[]) => void;
  onManageLabels?: () => void;
  onClose?: () => void;
}) {
  const [player, setPlayer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPlayer(customerId).then((result) => {
      if (cancelled) return;
      setPlayer(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!player) {
    return <p className="text-muted-foreground p-5 text-sm">This player couldn’t be loaded.</p>;
  }

  const name = player.fullName || player.username;
  const owner = player.storeUsername ?? player.managerUsername;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start gap-3 p-5 pb-4">
        <ChatAvatar name={name} src={player.avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="text-muted-foreground truncate text-sm">{player.username}</p>
          {owner && (
            <p className="text-muted-foreground truncate text-xs">Looked after by {owner}</p>
          )}
          <Badge variant={CUSTOMER_STATUS_VARIANT[player.status]} className="mt-1.5 capitalize">
            {player.status}
          </Badge>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player details"
            className="hover:bg-accent focus-visible:ring-ring/70 grid size-8 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      <section aria-label="Labels" className="border-t px-5 py-4">
        <h3 className="text-muted-foreground mb-2 text-xs font-semibold">Labels</h3>
        <div className="flex flex-wrap items-center gap-1">
          <LabelChips
            labels={player.labels}
            autoLabels={player.autoLabels}
            onRemove={async (labelId) => {
              const previous = player.labels;
              const next = previous.filter((label) => label.id !== labelId);
              setPlayer({ ...player, labels: next });
              const result = await setPlayerLabels(
                player.id,
                next.map((label) => label.id),
              );
              if (!result.ok || !result.labels) {
                setPlayer({ ...player, labels: previous });
                toast.error(result.message ?? 'Labels didn’t save.');
                return;
              }
              onLabelsChange(player.id, result.labels);
            }}
          />
          <LabelPicker
            customerId={player.id}
            value={player.labels}
            labels={labels}
            onManage={onManageLabels}
            onChange={(next) => {
              setPlayer({ ...player, labels: next as Customer['labels'] });
              onLabelsChange(player.id, next);
            }}
          />
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t px-5 py-4 text-sm">
        <Figure label="Balance" value={formatMoney(player.balance)} />
        <Figure label="Bonus" value={formatMoney(player.bonusBalance)} />
        <Figure label="Money in" value={formatMoney(player.totalSpent ?? '0')} />
        <Figure label="Money out" value={formatMoney(player.totalWithdrawn ?? '0')} />
        <Figure
          label="Last active"
          value={player.lastActivityAt ? formatDate(player.lastActivityAt) : 'Never'}
        />
        <Figure label="Joined" value={formatDate(player.registeredAt)} />
      </dl>

      {player.notes && (
        <section className="border-t px-5 py-4">
          <h3 className="text-muted-foreground mb-1 text-xs font-semibold">Notes</h3>
          <p className="text-sm whitespace-pre-line">{player.notes}</p>
        </section>
      )}

      <div className="mt-auto border-t p-4">
        <Link
          href={`/customers/${player.id}`}
          className="hover:bg-accent focus-visible:ring-ring/70 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px]"
        >
          Open full record
          <ExternalLinkIcon className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
