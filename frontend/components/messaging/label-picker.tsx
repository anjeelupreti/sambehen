'use client';

import { useState } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import { setPlayerLabels, type Label } from '@/app/(app)/messages/label-actions';
import { LABEL_DOTS, type ChipLabel } from '@/components/chat/label-chips';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Adds or removes a player's labels in one click each. Saves straight
 * away, so there is no form to submit and nothing to forget.
 */
export function LabelPicker({
  customerId,
  value,
  labels,
  onChange,
  onManage,
}: {
  customerId: string;
  value: ChipLabel[];
  labels: Label[];
  onChange: (labels: ChipLabel[]) => void;
  /** Masters only. */
  onManage?: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const chosen = new Set(value.map((label) => label.id));

  const toggle = async (label: Label) => {
    const next = chosen.has(label.id)
      ? value.filter((item) => item.id !== label.id)
      : [...value, { id: label.id, name: label.name, color: label.color }];
    const previous = value;
    onChange(next);
    setSaving(label.id);
    const result = await setPlayerLabels(
      customerId,
      next.map((item) => item.id),
    );
    setSaving(null);
    if (!result.ok || !result.labels) {
      onChange(previous);
      toast.error(result.message ?? 'Labels didn’t save.');
      return;
    }
    onChange(result.labels);
  };

  return (
    <Popover>
      <PopoverTrigger className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/70 inline-flex h-6 items-center gap-1 rounded-full border border-dashed px-2 text-xs font-medium outline-none focus-visible:ring-[3px]">
        <PlusIcon className="size-3" />
        Label
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {labels.length === 0 ? (
          <p className="text-muted-foreground px-2 py-3 text-sm">No labels yet.</p>
        ) : (
          <ul role="listbox" aria-label="Labels" aria-multiselectable>
            {labels.map((label) => {
              const on = chosen.has(label.id);
              return (
                <li key={label.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    disabled={saving !== null}
                    onClick={() => void toggle(label)}
                    className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none disabled:opacity-60"
                  >
                    <span
                      className={cn(
                        'size-2.5 rounded-full',
                        LABEL_DOTS[label.color] ?? LABEL_DOTS.gray,
                      )}
                    />
                    <span className="flex-1 truncate">{label.name}</span>
                    {on && <CheckIcon className="text-primary size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="text-primary hover:bg-accent mt-1 w-full rounded-md border-t px-2 py-2 text-left text-sm font-medium"
          >
            Manage labels
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
