'use client';

import { useState } from 'react';
import { PencilIcon, PlusIcon } from 'lucide-react';

import {
  createReferralProgram,
  updateReferralProgram,
  type RewardType,
} from '@/app/(app)/referrals/actions';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';
import type { components } from '@/lib/api-schema';

type Program = components['schemas']['ReferralProgramResponseDto'];

const REWARD_TYPES = [
  { value: 'fixed', label: 'Fixed amount — a flat bonus per referral' },
  { value: 'percentage', label: "Percentage — a share of the referee's spend" },
];

const isoDate = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

/**
 * Creates or edits a referral program.
 *
 * On edit, the reward type and start date are not offered. The API refuses
 * them, and rightly: codes have already been issued under this program, and
 * changing how it pays or when it began would rewrite the terms those
 * referrals were made under.
 *
 * Bonuses are money and are kept as strings the whole way through.
 */
export function ReferralProgramModal({ program }: { program?: Program }) {
  const editing = Boolean(program);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(program?.name ?? '');
  const [description, setDescription] = useState(program?.description ?? '');
  const [rewardType, setRewardType] = useState<RewardType>(
    (program?.rewardType as RewardType) ?? 'fixed',
  );
  const [referrerBonus, setReferrerBonus] = useState(program?.referrerBonus ?? '');
  const [refereeBonus, setRefereeBonus] = useState(program?.refereeBonus ?? '');
  const [minQualifyingDebit, setMinQualifyingDebit] = useState(program?.minQualifyingDebit ?? '');
  const [maxRewards, setMaxRewards] = useState(
    program?.maxRewardsPerReferrer ? String(program.maxRewardsPerReferrer) : '',
  );
  const [validFrom, setValidFrom] = useState(
    isoDate(program?.validFrom) || new Date().toISOString().slice(0, 10),
  );
  const [validTo, setValidTo] = useState(isoDate(program?.validTo));

  const create = useAction(createReferralProgram);
  const update = useAction(updateReferralProgram);
  const action = editing ? update : create;

  const ready = name.trim() && referrerBonus.trim() && refereeBonus.trim() && validFrom;

  return (
    <>
      {editing ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Edit ${program?.name}`}
          onClick={() => setOpen(true)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" />
          New program
        </Button>
      )}

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? 'Edit program' : 'New referral program'}
        description={
          editing
            ? 'The reward type and start date cannot change — codes have already been issued under these terms.'
            : 'Defines what a referrer and a referee each earn. Codes are issued to customers under the program afterwards.'
        }
        submitLabel={editing ? 'Save program' : 'Create program'}
        pending={action.pending}
        onSubmit={async () => {
          // Guard here rather than disabling the button: a disabled submit
          // with no explanation leaves the user hunting for what is missing,
          // and the required fields already mark themselves.
          if (!ready) return;

          const shared = {
            name: name.trim(),
            description: description.trim() || undefined,
            referrerBonus: referrerBonus.trim(),
            refereeBonus: refereeBonus.trim(),
            minQualifyingDebit: minQualifyingDebit.trim() || undefined,
            maxRewardsPerReferrer: maxRewards ? Number(maxRewards) : undefined,
            validTo: validTo ? new Date(validTo).toISOString() : undefined,
          };

          const result = editing
            ? await update.run(program!.id, shared)
            : await create.run({
                ...shared,
                rewardType,
                validFrom: new Date(validFrom).toISOString(),
              });

          if (result.ok) setOpen(false);
        }}
      >
        <TextField
          name="name"
          label="Program name"
          required
          autoFocus
          value={name}
          onChange={setName}
          error={action.fieldErrors.name}
        />

        <TextField
          name="description"
          label="Description"
          value={description}
          onChange={setDescription}
          error={action.fieldErrors.description}
        />

        {editing ? null : (
          <SelectField
            name="rewardType"
            label="Reward type"
            required
            value={rewardType}
            onChange={(value) => setRewardType(value as RewardType)}
            options={REWARD_TYPES}
            error={create.fieldErrors.rewardType}
            hint="Cannot be changed once codes exist."
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="referrerBonus"
            label="Referrer earns"
            required
            inputMode="decimal"
            placeholder={rewardType === 'percentage' ? '10' : '0.00'}
            value={referrerBonus}
            onChange={setReferrerBonus}
            error={action.fieldErrors.referrerBonus}
            hint={rewardType === 'percentage' ? 'Percent.' : 'Fixed amount.'}
          />
          <TextField
            name="refereeBonus"
            label="Referee earns"
            required
            inputMode="decimal"
            placeholder={rewardType === 'percentage' ? '5' : '0.00'}
            value={refereeBonus}
            onChange={setRefereeBonus}
            error={action.fieldErrors.refereeBonus}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="minQualifyingDebit"
            label="Minimum spend to qualify"
            inputMode="decimal"
            placeholder="0.00"
            value={minQualifyingDebit}
            onChange={setMinQualifyingDebit}
            error={action.fieldErrors.minQualifyingDebit}
            hint="The referee must deposit this much before a reward is earned."
          />
          <TextField
            name="maxRewardsPerReferrer"
            label="Max rewards per referrer"
            inputMode="numeric"
            placeholder="Unlimited"
            value={maxRewards}
            onChange={setMaxRewards}
            error={action.fieldErrors.maxRewardsPerReferrer}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {editing ? null : (
            <TextField
              name="validFrom"
              label="Valid from"
              required
              type="date"
              value={validFrom}
              onChange={setValidFrom}
              error={create.fieldErrors.validFrom}
            />
          )}
          <TextField
            name="validTo"
            label="Valid to"
            type="date"
            value={validTo}
            onChange={setValidTo}
            error={action.fieldErrors.validTo}
            hint="Leave empty for no end date."
          />
        </div>
      </FormModal>
    </>
  );
}
