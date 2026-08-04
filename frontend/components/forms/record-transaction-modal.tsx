'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { createTransaction } from '@/app/(app)/transactions/actions';
import { CustomerPicker } from '@/components/forms/customer-picker';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';
import type { Game, TransactionType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PickedCustomer {
  id: string;
  username: string;
  fullName: string | null;
}

const EMPTY = {
  type: 'debit' as TransactionType,
  amount: '',
  gameId: '',
  channel: '',
  referenceNo: '',
  note: '',
  occurredAt: '',
};

/**
 * Records a debit or credit.
 *
 * The direction is chosen with two labelled buttons rather than a dropdown
 * of the words "debit" and "credit": those are the API's terms, and staff
 * entering fifty rows a day should not have to translate them each time.
 * Each button states what the money did.
 *
 * Amount, type and customer cannot be changed after saving — the API
 * refuses, so that a wrong figure leaves a correction trail instead of
 * quietly becoming a different number. The modal says so before submit.
 */
export function RecordTransactionModal({
  games,
  customer,
  trigger,
}: {
  games: Game[];
  /** Fixed when opened from a customer's own page; otherwise searched for. */
  customer?: PickedCustomer;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PickedCustomer | null>(customer ?? null);
  const [form, setForm] = useState(EMPTY);
  const { run, pending, fieldErrors, clearFieldErrors } = useAction(createTransaction);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const reset = () => {
    setForm(EMPTY);
    setPicked(customer ?? null);
    clearFieldErrors();
  };

  const submit = async () => {
    if (!picked) return;

    const result = await run({
      customerId: picked.id,
      type: form.type,
      amount: form.amount.trim(),
      gameId: form.gameId || undefined,
      channel: form.channel.trim() || undefined,
      referenceNo: form.referenceNo.trim() || undefined,
      note: form.note.trim() || undefined,
      occurredAt: form.occurredAt || undefined,
    });

    if (result.ok) {
      setOpen(false);
      reset();
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" />
          Record entry
        </Button>
      )}

      <FormModal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title="Record an entry"
        description="Amount, direction and customer cannot be changed afterwards — a mistake is fixed with a correction, which leaves the original visible."
        submitLabel="Record entry"
        pending={pending}
        onSubmit={submit}
      >
        <CustomerPicker value={picked} onChange={setPicked} error={fieldErrors.customerId} />

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">
            Direction
            <span className="text-muted-foreground" aria-hidden>
              *
            </span>
          </span>

          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Direction">
            {(
              [
                { value: 'debit', title: 'Money in', hint: 'Customer deposited' },
                { value: 'credit', title: 'Money out', hint: 'Customer withdrew' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={form.type === option.value}
                onClick={() => set('type', option.value)}
                className={cn(
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  form.type === option.value
                    ? option.value === 'debit'
                      ? 'border-debit bg-debit/10'
                      : 'border-credit bg-credit/10'
                    : 'hover:bg-accent',
                )}
              >
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="text-muted-foreground block text-xs">{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <TextField
          name="amount"
          label="Amount"
          required
          inputMode="decimal"
          placeholder="0.00"
          value={form.amount}
          onChange={(value) => set('amount', value)}
          error={fieldErrors.amount}
          hint="Up to two decimal places."
        />

        <SelectField
          name="gameId"
          label="Game"
          value={form.gameId}
          onChange={(value) => set('gameId', value)}
          options={games.map((game) => ({ value: game.id, label: game.name }))}
          placeholder="No game"
          error={fieldErrors.gameId}
          hint="Optional. Entries with no game are grouped separately on the dashboard."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="referenceNo"
            label="Reference"
            maxLength={100}
            value={form.referenceNo}
            onChange={(value) => set('referenceNo', value)}
            error={fieldErrors.referenceNo}
          />
          <TextField
            name="channel"
            label="Channel"
            maxLength={50}
            value={form.channel}
            onChange={(value) => set('channel', value)}
            error={fieldErrors.channel}
          />
        </div>

        <TextField
          name="occurredAt"
          label="Occurred at"
          type="datetime-local"
          value={form.occurredAt}
          onChange={(value) => set('occurredAt', value)}
          error={fieldErrors.occurredAt}
          hint="Leave empty to record it as now."
        />

        <TextField
          name="note"
          label="Note"
          maxLength={1000}
          value={form.note}
          onChange={(value) => set('note', value)}
          error={fieldErrors.note}
        />
      </FormModal>
    </>
  );
}
