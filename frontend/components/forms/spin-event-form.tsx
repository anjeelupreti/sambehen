'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2Icon } from 'lucide-react';

import { createSpinEvent, listQualifiedCustomers } from '@/app/(app)/spin-events/actions';
import { listActiveVipCriteria } from '@/app/(app)/vip-criteria/actions';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAction } from '@/hooks/use-action';
import type { VipCriteria } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Qualified {
  id: string;
  username: string;
  tier: number;
}

interface WinnerRow {
  customerId: string;
  prizeLabel: string;
  prizeAmount: string;
  rank: number;
}

/**
 * Creates a spin event.
 *
 * The selection mode is the decision the rest of the form hangs off, so it
 * comes first and is stated in plain terms rather than as the API's
 * `preselected` / `post_draw`:
 *
 * - **preselected** — winners are chosen now, from customers who already
 *   hold a qualification for the criteria. The API *requires* the winner
 *   list in this mode.
 * - **post-draw** — the event is scheduled empty and winners are recorded
 *   after it runs. The API *rejects* a winner list in this mode.
 *
 * That is a genuine either/or in the contract, not a preference, so the
 * winner section appears and disappears with the mode rather than being
 * shown greyed out.
 *
 * Winners can only be drawn from qualified customers: the API rejects
 * anyone without a qualification for this event's criteria, so offering the
 * full customer list would produce a 422 nobody could act on.
 */
export function SpinEventForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [criteriaList, setCriteriaList] = useState<VipCriteria[]>([]);
  const [qualified, setQualified] = useState<Qualified[]>([]);

  const [name, setName] = useState('');
  const [vipCriteriaId, setVipCriteriaId] = useState('');
  const [selectionMode, setSelectionMode] = useState<'preselected' | 'post_draw'>('post_draw');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [prizeDescription, setPrizeDescription] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [winners, setWinners] = useState<WinnerRow[]>([]);

  const { run, fieldErrors } = useAction(createSpinEvent);

  useEffect(() => {
    // Only currently-active criteria: the API refuses an event under a
    // closed one.
    listActiveVipCriteria().then(setCriteriaList).catch(console.error);
  }, []);

  useEffect(() => {
    if (!vipCriteriaId) {
      setQualified([]);
      setWinners([]);
      return;
    }
    // Changing the criteria changes who is eligible, so any winners already
    // picked under the previous one are no longer valid.
    setWinners([]);
    listQualifiedCustomers(vipCriteriaId).then(setQualified).catch(console.error);
  }, [vipCriteriaId]);

  const preselected = selectionMode === 'preselected';
  const ready = name.trim() && vipCriteriaId && scheduledAt && (!preselected || winners.length > 0);

  const addWinner = () => {
    const taken = new Set(winners.map((w) => w.customerId));
    const next = qualified.find((customer) => !taken.has(customer.id));
    if (!next) return;

    setWinners((current) => [
      ...current,
      { customerId: next.id, prizeLabel: '', prizeAmount: '', rank: current.length + 1 },
    ]);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await run({
        name: name.trim(),
        vipCriteriaId,
        selectionMode,
        scheduledAt: new Date(scheduledAt).toISOString(),
        ...(prizeDescription.trim() ? { prizeDescription: prizeDescription.trim() } : {}),
        ...(prizePool.trim() ? { prizePool: prizePool.trim() } : {}),
        // Required when preselected, rejected otherwise — so it is omitted
        // entirely rather than sent as an empty array.
        ...(preselected
          ? {
              winners: winners.map((winner, index) => ({
                customerId: winner.customerId,
                prizeLabel: winner.prizeLabel.trim() || `Prize ${index + 1}`,
                prizeAmount: winner.prizeAmount.trim() || '0.00',
                rank: index + 1,
              })),
            }
          : {}),
      });

      if (result.ok) {
        router.push('/spin-winners');
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <TextField
        name="name"
        label="Event name"
        required
        autoFocus
        value={name}
        onChange={setName}
        error={fieldErrors.name}
      />

      <SelectField
        name="vipCriteriaId"
        label="VIP criteria"
        required
        value={vipCriteriaId}
        onChange={setVipCriteriaId}
        options={criteriaList.map((criteria) => ({
          value: criteria.id,
          label: `${criteria.name} — tier ${criteria.tier}`,
        }))}
        placeholder={criteriaList.length ? 'Choose an active criteria' : 'No active criteria'}
        error={fieldErrors.vipCriteriaId}
        hint="Decides who is eligible. Only currently-active criteria can host an event."
      />

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">
          How are winners decided?
          <span className="text-muted-foreground" aria-hidden>
            *
          </span>
        </span>

        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Selection mode">
          {(
            [
              {
                value: 'post_draw',
                title: 'Recorded after the draw',
                hint: 'Schedule now, enter winners once it has run.',
              },
              {
                value: 'preselected',
                title: 'Chosen now',
                hint: 'Pick winners up front from qualified customers.',
              },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={selectionMode === option.value}
              onClick={() => setSelectionMode(option.value)}
              className={cn(
                'rounded-md border px-3 py-2 text-left transition-colors',
                selectionMode === option.value ? 'border-primary bg-primary/10' : 'hover:bg-accent',
              )}
            >
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="text-muted-foreground block text-xs">{option.hint}</span>
            </button>
          ))}
        </div>
        {fieldErrors.selectionMode ? (
          <p className="text-destructive text-xs">{fieldErrors.selectionMode}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="scheduledAt"
          label="Scheduled for"
          required
          type="datetime-local"
          value={scheduledAt}
          onChange={setScheduledAt}
          error={fieldErrors.scheduledAt}
        />
        <TextField
          name="prizePool"
          label="Prize pool"
          inputMode="decimal"
          placeholder="0.00"
          value={prizePool}
          onChange={setPrizePool}
          error={fieldErrors.prizePool}
        />
      </div>

      <TextField
        name="prizeDescription"
        label="Prize description"
        value={prizeDescription}
        onChange={setPrizeDescription}
        error={fieldErrors.prizeDescription}
      />

      {preselected ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label>Winners</Label>
              <p className="text-muted-foreground text-xs">
                {vipCriteriaId
                  ? `${qualified.length} customer${qualified.length === 1 ? '' : 's'} currently qualify.`
                  : 'Choose a criteria first — eligibility comes from it.'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addWinner}
              disabled={!vipCriteriaId || winners.length >= qualified.length}
            >
              Add winner
            </Button>
          </div>

          {winners.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">
              At least one winner is required when they are chosen up front.
            </p>
          ) : (
            <ul className="space-y-2">
              {winners.map((winner, index) => (
                <li key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
                  <SelectField
                    name={`winner-${index}`}
                    label={index === 0 ? 'Customer' : ''}
                    value={winner.customerId}
                    onChange={(value) =>
                      setWinners((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, customerId: value } : row,
                        ),
                      )
                    }
                    options={qualified.map((customer) => ({
                      value: customer.id,
                      label: `${customer.username} · tier ${customer.tier}`,
                    }))}
                  />
                  <TextField
                    name={`prizeLabel-${index}`}
                    label={index === 0 ? 'Prize' : ''}
                    placeholder={`Prize ${index + 1}`}
                    value={winner.prizeLabel}
                    onChange={(value) =>
                      setWinners((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, prizeLabel: value } : row,
                        ),
                      )
                    }
                  />
                  <TextField
                    name={`prizeAmount-${index}`}
                    label={index === 0 ? 'Amount' : ''}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={winner.prizeAmount}
                    onChange={(value) =>
                      setWinners((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, prizeAmount: value } : row,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label={`Remove winner ${index + 1}`}
                    onClick={() => setWinners((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-muted-foreground text-xs">
            Rank follows this order — the first row is first place.{' '}
            {winners.length > 0 ? <Badge variant="outline">{winners.length} selected</Badge> : null}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground rounded-md border p-3 text-sm">
          Winners are entered after the draw, from the Spins page. The event is created empty.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !ready}>
          {pending ? 'Creating…' : 'Create event'}
        </Button>
      </div>
    </form>
  );
}
