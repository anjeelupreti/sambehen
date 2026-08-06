'use client';

import { useState, useTransition } from 'react';
import { Loader2Icon, UsersIcon } from 'lucide-react';

import { previewRecipients, type RecipientFilter } from '@/app/(app)/broadcast/actions';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCount } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { components } from '@/lib/api-schema';

type RecipientPreview = components['schemas']['RecipientPreviewDto'];

/**
 * Picks who a broadcast goes to, and proves it before anyone sends.
 *
 * The preview is the point of this component. An audience filter is easy to
 * get subtly wrong — "customers with transactions" and "customers who
 * transacted recently" differ by thousands of people — and the mistake is
 * invisible until the mail has gone out and cannot be recalled. So the send
 * button stays disabled until the audience has been counted against live
 * data.
 */

/** One-click audiences the API computes itself. */
const QUICK_FILTERS = [
  { value: 'all_active', label: 'All active', hint: 'Active and seen recently' },
  { value: 'with_transactions', label: 'Has transacted', hint: 'At least one entry' },
  { value: 'without_transactions', label: 'Never transacted', hint: 'No entries at all' },
  { value: 'recent_transactions', label: 'Recently active', hint: 'Transacted in 30 days' },
  { value: 'high_spenders', label: 'High spenders', hint: 'At or above the threshold' },
  { value: 'low_spenders', label: 'Low spenders', hint: 'Below the threshold' },
] as const;

const SPEND_OPERATORS = [
  { value: 'gte', label: 'At or above' },
  { value: 'gt', label: 'More than' },
  { value: 'lte', label: 'At or below' },
  { value: 'lt', label: 'Less than' },
  { value: 'eq', label: 'Exactly' },
  { value: 'between', label: 'Between' },
];

export function AudienceBuilder({
  filter,
  onChange,
  preview,
  onPreview,
}: {
  filter: RecipientFilter;
  onChange: (filter: RecipientFilter) => void;
  preview: RecipientPreview | null;
  onPreview: (preview: RecipientPreview | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Any change invalidates the count — otherwise a stale "412 recipients"
  // would sit under a filter that no longer selects them.
  const set = (next: Partial<RecipientFilter>) => {
    onChange({ ...filter, ...next });
    onPreview(null);
  };

  const runPreview = () => {
    startTransition(async () => {
      setError(null);
      const result = await previewRecipients({ ...filter, sampleSize: 8 });
      if (result.ok && result.data) onPreview(result.data);
      else if (!result.ok) setError(result.message);
    });
  };

  const sendable = preview ? preview.totalRecipients - preview.excluded : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Audience</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_FILTERS.map((option) => {
            const active = filter.quickFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  set({
                    quickFilter: active
                      ? undefined
                      : (option.value as RecipientFilter['quickFilter']),
                  })
                }
                className={cn(
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  active ? 'border-primary bg-primary/10' : 'hover:bg-accent',
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="text-muted-foreground block text-xs">{option.hint}</span>
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          Optional. Leave all unselected to target everyone the filters below allow.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          name="spendingOperator"
          label="Total spend"
          value={filter.spendingOperator ?? ''}
          onChange={(v) =>
            set({ spendingOperator: (v || undefined) as RecipientFilter['spendingOperator'] })
          }
          options={SPEND_OPERATORS}
          placeholder="Any amount"
        />
        <TextField
          name="minAmount"
          label={filter.spendingOperator === 'between' ? 'From' : 'Amount'}
          inputMode="decimal"
          placeholder="0.00"
          value={filter.minAmount ?? ''}
          onChange={(v) => set({ minAmount: v || undefined })}
        />
        <TextField
          name="maxAmount"
          label="To"
          inputMode="decimal"
          placeholder="0.00"
          value={filter.maxAmount ?? ''}
          onChange={(v) => set({ maxAmount: v || undefined })}
          hint={filter.spendingOperator === 'between' ? 'Required for "between".' : undefined}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          name="city"
          label="City"
          value={filter.city ?? ''}
          onChange={(v) => set({ city: v || undefined })}
        />
        <TextField
          name="country"
          label="Country"
          value={filter.country ?? ''}
          onChange={(v) => set({ country: v || undefined })}
        />
        <TextField
          name="lastNDays"
          label="Active within (days)"
          inputMode="numeric"
          value={filter.lastNDays ? String(filter.lastNDays) : ''}
          onChange={(v) => set({ lastNDays: v ? Number(v) : undefined })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
        <Button type="button" variant="outline" size="sm" onClick={runPreview} disabled={pending}>
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <UsersIcon className="size-4" />
          )}
          {pending ? 'Counting…' : 'Preview audience'}
        </Button>

        {error ? <span className="text-destructive text-sm">{error}</span> : null}

        {preview && !error ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="default">{formatCount(sendable)} will receive</Badge>
            {preview.excluded > 0 ? (
              <Badge
                variant="outline"
                title="No email address, opted out, or previously hard-bounced"
              >
                {formatCount(preview.excluded)} excluded
              </Badge>
            ) : null}
            <span className="text-muted-foreground text-xs">
              of {formatCount(preview.totalRecipients)} selected
            </span>
          </div>
        ) : null}
      </div>

      {preview && preview.sample.length > 0 ? (
        <div className="rounded-md border">
          <p className="text-muted-foreground border-b px-3 py-2 text-xs">
            Sample of the audience — check this looks right before sending.
          </p>
          <ul className="divide-y">
            {preview.sample.slice(0, 8).map((entry, index) => {
              const row = entry as Record<string, unknown>;
              return (
                <li key={index} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate text-sm font-medium">
                    {String(row.username ?? row.fullName ?? '—')}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {String(row.email ?? '')}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
