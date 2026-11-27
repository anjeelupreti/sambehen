'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { recordWin } from '@/app/(app)/wins/actions';
import { CustomerPicker } from '@/components/forms/customer-picker';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';
import type { Game } from '@/lib/types';

interface PickedCustomer {
  id: string;
  username: string;
  fullName: string | null;
}

const EMPTY = { amount: '', gameId: '', wonAt: '' };

/** Records a player's big win for the wins feed. */
export function RecordWinModal({ games }: { games: Game[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PickedCustomer | null>(null);
  const [form, setForm] = useState(EMPTY);
  const { run, pending, fieldErrors, clearFieldErrors } = useAction(recordWin);

  const reset = () => {
    setForm(EMPTY);
    setPicked(null);
    clearFieldErrors();
  };

  const submit = async () => {
    if (!picked) return;
    const result = await run({
      customerId: picked.id,
      amount: form.amount.trim(),
      gameId: form.gameId || undefined,
      wonAt: form.wonAt || undefined,
    });
    if (result.ok) {
      setOpen(false);
      reset();
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Record a win
      </Button>

      <FormModal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title="Record a win"
        submitLabel="Record win"
        pending={pending}
        onSubmit={submit}
      >
        <CustomerPicker value={picked} onChange={setPicked} error={fieldErrors.customerId} />
        <TextField
          name="amount"
          label="Amount won"
          required
          inputMode="decimal"
          placeholder="0.00"
          value={form.amount}
          onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
          error={fieldErrors.amount}
        />
        <SelectField
          name="gameId"
          label="Game"
          value={form.gameId}
          onChange={(value) => setForm((current) => ({ ...current, gameId: value }))}
          options={games.map((game) => ({ value: game.id, label: game.name }))}
          placeholder="No game"
          error={fieldErrors.gameId}
        />
        <TextField
          name="wonAt"
          label="Won at"
          type="datetime-local"
          value={form.wonAt}
          onChange={(value) => setForm((current) => ({ ...current, wonAt: value }))}
          error={fieldErrors.wonAt}
          hint="Leave empty for now."
        />
      </FormModal>
    </>
  );
}
