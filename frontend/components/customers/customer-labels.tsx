'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import { setPlayerLabels, type Label } from '@/app/(app)/messages/label-actions';
import { LabelChips, type ChipLabel } from '@/components/chat/label-chips';
import { LabelPicker } from '@/components/messaging/label-picker';

/** A player's labels on their record, with the picker to change them. */
export function CustomerLabels({
  customerId,
  initial,
  autoLabels,
  labels,
}: {
  customerId: string;
  initial: ChipLabel[];
  autoLabels: string[];
  labels: Label[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <LabelChips
        labels={value}
        autoLabels={autoLabels}
        onRemove={async (labelId) => {
          const previous = value;
          const next = previous.filter((label) => label.id !== labelId);
          setValue(next);
          const result = await setPlayerLabels(
            customerId,
            next.map((label) => label.id),
          );
          if (!result.ok || !result.labels) {
            setValue(previous);
            toast.error(result.message ?? 'Labels didn’t save.');
          }
        }}
      />
      <LabelPicker customerId={customerId} value={value} labels={labels} onChange={setValue} />
    </div>
  );
}
