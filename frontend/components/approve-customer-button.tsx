'use client';

import { useState } from 'react';
import { UserCheckIcon } from 'lucide-react';

import { approveCustomer } from '@/app/(app)/customers/actions';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';
import { ownerOptions, type AssignableOwner } from '@/components/forms/new-customer-modal';

/**
 * Approves a pending self-registration.
 *
 * A pending customer has no owner, so approval and assignment happen in
 * the same step rather than two — there is no "approved but unowned"
 * state for a separate reassign step to land in between.
 */
export function ApproveCustomerButton({
  customerId,
  owners,
}: {
  customerId: string;
  owners: AssignableOwner[];
}) {
  const [open, setOpen] = useState(false);
  const [ownerStaffId, setOwnerStaffId] = useState('');
  const [missing, setMissing] = useState(false);
  const { run, pending, fieldErrors } = useAction(approveCustomer);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setOwnerStaffId('');
      setMissing(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserCheckIcon className="size-4" />
        Approve
      </Button>

      <FormModal
        open={open}
        onOpenChange={close}
        title="Approve registration"
        description="Assign a manager or store. The customer can sign in as soon as this is saved."
        submitLabel="Approve"
        pending={pending}
        onSubmit={async () => {
          if (!ownerStaffId) {
            setMissing(true);
            return;
          }
          const result = await run(customerId, ownerStaffId);
          if (result.ok) close(false);
        }}
      >
        <SelectField
          name="ownerStaffId"
          label="Assign to"
          required
          value={ownerStaffId}
          onChange={(value) => {
            setOwnerStaffId(value);
            setMissing(false);
          }}
          options={ownerOptions(owners)}
          placeholder="Choose a manager or store"
          error={missing ? 'Choose who will look after this player.' : fieldErrors.ownerStaffId}
        />
      </FormModal>
    </>
  );
}
