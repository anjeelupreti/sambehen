'use client';

import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import {
  createLabel,
  deleteLabel,
  updateLabel,
  type Label,
  type LabelColor,
} from '@/app/(app)/messages/label-actions';
import { LABEL_DOTS, LABEL_STYLES } from '@/components/chat/label-chips';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const COLORS: LabelColor[] = ['blue', 'green', 'amber', 'red', 'purple', 'pink', 'teal', 'gray'];

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: LabelColor) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex gap-1">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            'grid size-6 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70',
            value === color && 'ring-foreground ring-2 ring-offset-2 ring-offset-background',
          )}
        >
          <span className={cn('size-4 rounded-full', LABEL_DOTS[color])} />
        </button>
      ))}
    </div>
  );
}

/** The master's list of labels: add, rename, recolour and delete. */
export function ManageLabelsDialog({
  open,
  onOpenChange,
  labels,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: Label[];
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>('blue');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<{ ok: boolean; message?: string }>, done?: string) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? 'That didn’t save.');
      return false;
    }
    if (done) toast.success(done);
    onChanged();
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Labels</DialogTitle>
          <DialogDescription>
            Labels are shared by every store. Staff can add them to their players.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3 rounded-xl border p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            if (await run(() => createLabel(name.trim(), color), 'Label added.')) setName('');
          }}
        >
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New label"
              maxLength={40}
              aria-label="New label name"
            />
            <Button type="submit" disabled={busy || !name.trim()}>
              Add
            </Button>
          </div>
          <ColorPicker value={color} onChange={setColor} />
        </form>

        <ul className="max-h-80 divide-y overflow-y-auto">
          {labels.map((label) => (
            <li key={label.id} className="flex items-center gap-2 py-2.5">
              <input
                defaultValue={label.name}
                aria-label={`Rename ${label.name}`}
                maxLength={40}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next && next !== label.name)
                    void run(() => updateLabel(label.id, { name: next }));
                }}
                className={cn(
                  'min-w-0 flex-1 rounded-full px-2.5 py-1 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70',
                  LABEL_STYLES[label.color] ?? LABEL_STYLES.gray,
                )}
              />
              <span className="text-muted-foreground w-16 text-right text-xs tabular-nums">
                {label.playerCount} {label.playerCount === 1 ? 'player' : 'players'}
              </span>
              <select
                aria-label={`Colour of ${label.name}`}
                value={label.color}
                onChange={(event) =>
                  void run(() => updateLabel(label.id, { color: event.target.value as LabelColor }))
                }
                className="bg-background h-8 rounded-md border px-1.5 text-xs"
              >
                {COLORS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Delete ${label.name}`}
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(`Delete "${label.name}"? It comes off every player who has it.`)
                  ) {
                    void run(() => deleteLabel(label.id), 'Label deleted.');
                  }
                }}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
