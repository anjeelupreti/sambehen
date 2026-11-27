'use client';

import { useState } from 'react';

import { reassignCustomer } from '@/app/(app)/customers/actions';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField } from '@/components/forms/form-field';
import { ownerOptions, type AssignableOwner } from '@/components/forms/new-customer-modal';
import { useAction } from '@/hooks/use-action';

/** Moves a player to another store or manager. */
export function AssignOwnerDialog({
  customerId,
  username,
  currentOwnerId,
  owners,
  open,
  onOpenChange,
}: {
  customerId: string;
  username: string;
  currentOwnerId: string | null;
  owners: AssignableOwner[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [ownerStaffId, setOwnerStaffId] = useState(currentOwnerId ?? '');
  const { run, pending, fieldErrors } = useAction(reassignCustomer);

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setOwnerStaffId(currentOwnerId ?? '');
      }}
      title={`Assign ${username}`}
      submitLabel="Save"
      pending={pending}
      onSubmit={async () => {
        if (!ownerStaffId || ownerStaffId === currentOwnerId) {
          onOpenChange(false);
          return;
        }
        const result = await run(customerId, ownerStaffId);
        if (result.ok) onOpenChange(false);
      }}
    >
      <SelectField
        name="ownerStaffId"
        label="Store or manager"
        required
        value={ownerStaffId}
        onChange={setOwnerStaffId}
        options={ownerOptions(owners)}
        placeholder="Choose a store or manager"
        error={fieldErrors.ownerStaffId}
      />
    </FormModal>
  );
}
