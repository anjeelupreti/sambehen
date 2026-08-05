'use client';

import { useState, useEffect } from 'react';
import { updateCustomer } from '@/app/(app)/customers/actions';
import { FormModal } from '@/components/forms/form-modal';
import { TextField } from '@/components/forms/form-field';
import { useAction } from '@/hooks/use-action';
import type { Customer } from '@/lib/types';

export function EditCustomerModal({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    email: customer.email,
    fullName: customer.fullName ?? '',
    phone: customer.phone ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    country: customer.country ?? '',
    notes: customer.notes ?? '',
  });

  const { run, pending, fieldErrors, clearFieldErrors } = useAction(updateCustomer);

  useEffect(() => {
    if (open) {
      setForm({
        email: customer.email,
        fullName: customer.fullName ?? '',
        phone: customer.phone ?? '',
        city: customer.city ?? '',
        state: customer.state ?? '',
        country: customer.country ?? '',
        notes: customer.notes ?? '',
      });
      clearFieldErrors();
    }
  }, [open, customer, clearFieldErrors]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      clearFieldErrors();
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={close}
      title={`Edit ${customer.username}`}
      description="Update customer profile. To ban or suspend the customer, use the actions menu."
      submitLabel="Save changes"
      pending={pending}
      onSubmit={async () => {
        const result = await run(customer.id, {
          email: form.email.trim(),
          fullName: form.fullName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          country: form.country.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
        if (result.ok) close(false);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
        <TextField
          name="fullName"
          label="Full name"
          maxLength={200}
          value={form.fullName}
          onChange={(v) => set('fullName', v)}
          error={fieldErrors.fullName}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="phone"
          label="Phone"
          maxLength={32}
          inputMode="tel"
          value={form.phone}
          onChange={(v) => set('phone', v)}
          error={fieldErrors.phone}
        />
        <TextField
          name="city"
          label="City"
          maxLength={120}
          value={form.city}
          onChange={(v) => set('city', v)}
          error={fieldErrors.city}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="state"
          label="State / Province"
          maxLength={120}
          value={form.state}
          onChange={(v) => set('state', v)}
          error={fieldErrors.state}
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
  );
}
