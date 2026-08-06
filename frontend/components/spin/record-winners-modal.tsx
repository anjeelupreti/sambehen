'use client';

import { useEffect, useState } from 'react';
import { TrophyIcon, Trash2Icon } from 'lucide-react';

import { listQualifiedCustomers, recordWinners } from '@/app/(app)/spin-events/actions';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';

interface Qualified {
  id: string;
  username: string;
  tier: number;
}

interface WinnerRow {
  customerId: string;
  prizeLabel: string;
  prizeAmount: string;
}

/**
 * Records winners after a draw has run.
 *
 * Without this a post-draw event could be scheduled and never finished —
 * the event exists, the draw happens, and there is nowhere to enter who
 * won.
 *
 * Only offered on post-draw events. A preselected event already carries its
 * winners and the API refuses to add more, so the option is absent rather
 * than present-and-failing.
 *
 * The customer list is limited to holders of a qualification for this
 * event's criteria, which is the same set the API will accept.
 */
export function RecordWinnersModal({
  eventId,
  eventName,
  criteriaId,
}: {
  eventId: string;
  eventName: string;
  criteriaId: string;
}) {
  const [open, setOpen] = useState(false);
  const [qualified, setQualified] = useState<Qualified[]>([]);
  const [rows, setRows] = useState<WinnerRow[]>([]);
  const { run, pending } = useAction(recordWinners);

  useEffect(() => {
    if (!open || !criteriaId) return;
    listQualifiedCustomers(criteriaId).then(setQualified).catch(console.error);
  }, [open, criteriaId]);

  const addRow = () => {
    const taken = new Set(rows.map((row) => row.customerId));
    const next = qualified.find((customer) => !taken.has(customer.id));
    if (!next) return;
    setRows((current) => [...current, { customerId: next.id, prizeLabel: '', prizeAmount: '' }]);
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) setRows([]);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <TrophyIcon className="size-4" />
        Record winners
      </Button>

      <FormModal
        open={open}
        onOpenChange={close}
        title={`Record winners — ${eventName}`}
        description="Only customers holding a qualification for this event's criteria can be entered. Rank follows the order below, so the first row is first place."
        submitLabel={rows.length ? `Record ${rows.length}` : 'Record'}
        pending={pending}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        onSubmit={async () => {
          if (rows.length === 0) return;

          const result = await run(
            eventId,
            rows.map((row, index) => ({
              customerId: row.customerId,
              prizeLabel: row.prizeLabel.trim() || `Prize ${index + 1}`,
              prizeAmount: row.prizeAmount.trim() || '0.00',
              rank: index + 1,
            })),
          );

          if (result.ok) close(false);
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            {qualified.length} customer{qualified.length === 1 ? '' : 's'} qualify for this event.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={rows.length >= qualified.length}
          >
            Add winner
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Add at least one winner.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_110px_auto]">
                <SelectField
                  name={`winner-${index}`}
                  label={index === 0 ? 'Customer' : ''}
                  value={row.customerId}
                  onChange={(value) =>
                    setRows((current) =>
                      current.map((r, i) => (i === index ? { ...r, customerId: value } : r)),
                    )
                  }
                  options={qualified.map((customer) => ({
                    value: customer.id,
                    label: `${customer.username} · tier ${customer.tier}`,
                  }))}
                />
                <TextField
                  name={`label-${index}`}
                  label={index === 0 ? 'Prize' : ''}
                  placeholder={`Prize ${index + 1}`}
                  value={row.prizeLabel}
                  onChange={(value) =>
                    setRows((current) =>
                      current.map((r, i) => (i === index ? { ...r, prizeLabel: value } : r)),
                    )
                  }
                />
                <TextField
                  name={`amount-${index}`}
                  label={index === 0 ? 'Amount' : ''}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={row.prizeAmount}
                  onChange={(value) =>
                    setRows((current) =>
                      current.map((r, i) => (i === index ? { ...r, prizeAmount: value } : r)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Remove row ${index + 1}`}
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </FormModal>
    </>
  );
}
