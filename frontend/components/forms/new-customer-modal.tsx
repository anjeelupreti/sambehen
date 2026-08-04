'use client';

import { useState } from 'react';
import { UserPlusIcon } from 'lucide-react';

import { createCustomer } from '@/app/(app)/customers/actions';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';
import type { StaffRole } from '@/lib/types';

const EMPTY = {
  username: '',
  email: '',
  password: '',
  ownerStaffId: '',
  fullName: '',
  phone: '',
  city: '',
  country: '',
  notes: '',
};

export interface AssignableOwner {
  id: string;
  username: string;
  role: string;
}

/**
 * Creates a customer.
 *
 * The password is set here by staff and is the customer's to use, not to
 * change — every edit to a customer, credentials included, is made by the
 * staff above them.
 *
 * Ownership is where the roles differ. Customers hang off a manager or a
 * runner, so a **master must name an owner** — the API defaults ownership
 * to the caller, and a master is not in the chain. A manager may hand the
 * customer to one of their runners or keep it. A runner is never asked:
 * the API assigns to them regardless.
 */
export function NewCustomerModal({
  actorRole,
  owners,
}: {
  actorRole: StaffRole;
  owners: AssignableOwner[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { run, pending, fieldErrors, clearFieldErrors } = useAction(createCustomer);

  const needsOwner = actorRole === 'master';
  const canChooseOwner = actorRole !== 'runner';

  const set = <K extends keyof typeof EMPTY>(key: K, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setForm(EMPTY);
      clearFieldErrors();
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlusIcon className="size-4" />
        New customer
      </Button>

      <FormModal
        open={open}
        onOpenChange={close}
        title="New customer"
        description={
          needsOwner
            ? 'Customers belong to a manager or a runner, so choose who owns this one. They can read their own record but cannot change anything about it, including this password.'
            : 'They are assigned to you unless you say otherwise. Customers can read their own record but cannot change anything about it, including this password.'
        }
        submitLabel="Create customer"
        pending={pending}
        onSubmit={async () => {
          const result = await run({
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            ownerStaffId: form.ownerStaffId || undefined,
            fullName: form.fullName.trim() || undefined,
            phone: form.phone.trim() || undefined,
            city: form.city.trim() || undefined,
            country: form.country.trim() || undefined,
            notes: form.notes.trim() || undefined,
          });
          if (result.ok) close(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="username"
            label="Username"
            required
            autoFocus
            maxLength={100}
            value={form.username}
            onChange={(v) => set('username', v)}
            error={fieldErrors.username}
          />
          <TextField
            name="email"
            label="Email"
            required
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(v) => set('email', v)}
            error={fieldErrors.email}
          />
        </div>

        <TextField
          name="password"
          label="Password"
          required
          type="password"
          maxLength={128}
          value={form.password}
          onChange={(v) => set('password', v)}
          error={fieldErrors.password}
          hint="Share it with the customer. Only staff can change it later."
        />

        {canChooseOwner ? (
          <SelectField
            name="ownerStaffId"
            label="Owned by"
            required={needsOwner}
            value={form.ownerStaffId}
            onChange={(v) => set('ownerStaffId', v)}
            options={owners.map((owner) => ({
              value: owner.id,
              label: `${owner.username} · ${owner.role}`,
            }))}
            placeholder={needsOwner ? 'Choose a manager or runner' : 'Keep for myself'}
            error={fieldErrors.ownerStaffId}
            hint={
              needsOwner
                ? 'A master sits above the chain, so a customer cannot be owned by you.'
                : 'Leave empty to keep this customer yourself.'
            }
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="fullName"
            label="Full name"
            maxLength={200}
            value={form.fullName}
            onChange={(v) => set('fullName', v)}
            error={fieldErrors.fullName}
          />
          <TextField
            name="phone"
            label="Phone"
            maxLength={32}
            inputMode="tel"
            value={form.phone}
            onChange={(v) => set('phone', v)}
            error={fieldErrors.phone}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="city"
            label="City"
            maxLength={120}
            value={form.city}
            onChange={(v) => set('city', v)}
            error={fieldErrors.city}
          />
          <TextField
            name="country"
            label="Country"
            maxLength={120}
            value={form.country}
            onChange={(v) => set('country', v)}
            error={fieldErrors.country}
          />
        </div>

        <TextField
          name="notes"
          label="Notes"
          maxLength={2000}
          value={form.notes}
          onChange={(v) => set('notes', v)}
          error={fieldErrors.notes}
        />
      </FormModal>
    </>
  );
}
