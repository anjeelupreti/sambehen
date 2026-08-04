'use client';

import { useState } from 'react';

import { createCorrection } from '@/app/(app)/transactions/actions';
import { FormModal } from '@/components/forms/form-modal';
import { TextField } from '@/components/forms/form-field';
import { Money } from '@/components/money';
import { useAction } from '@/hooks/use-action';

/**
 * Corrects an earlier entry.
 *
 * The original is never edited. This writes a credit carrying the original's
 * id as its parent, and that parent link is exactly what keeps it out of
 * `totalWithdrawn` — the money was never taken out, the figure was wrong.
 *
 * A reason is required by the API and it is the right requirement: a
 * correction with no explanation is indistinguishable from a mistake when
 * someone reads the trail months later.
 */
export function CorrectionModal({
  transactionId,
  originalAmount,
  customerUsername,
  open,
  onOpenChange,
}: {
  transactionId: string;
  originalAmount: string;
  customerUsername: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const { run, pending, fieldErrors, clearFieldErrors } = useAction(createCorrection);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setAmount('');
      setReason('');
      clearFieldErrors();
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={close}
      title="Correct this entry"
      description="The original entry stays on the record. This adds a linked correction, which is counted apart from withdrawals."
      submitLabel="Record correction"
      pending={pending}
      onSubmit={async () => {
        const result = await run(transactionId, amount.trim(), reason.trim());
        if (result.ok) close(false);
      }}
    >
      <div className="bg-muted/50 rounded-md border px-3 py-2 text-sm">
        <span className="text-muted-foreground">Correcting </span>
        <Money value={originalAmount} />
        {customerUsername ? (
          <span className="text-muted-foreground"> for {customerUsername}</span>
        ) : null}
      </div>

      <TextField
        name="amount"
        label="Correction amount"
        required
        autoFocus
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={setAmount}
        error={fieldErrors.amount}
        hint="How much the original entry was out by, not the corrected total."
      />

      <TextField
        name="reason"
        label="Reason"
        required
        maxLength={1000}
        placeholder="Why this entry was wrong"
        value={reason}
        onChange={setReason}
        error={fieldErrors.reason}
      />
    </FormModal>
  );
}
