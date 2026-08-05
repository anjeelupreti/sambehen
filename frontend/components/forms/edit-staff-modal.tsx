'use client';

import { useState, useEffect } from 'react';
import { updateStaff } from '@/app/(app)/staff/actions';
import { FormModal } from '@/components/forms/form-modal';
import { TextField } from '@/components/forms/form-field';
import { useAction } from '@/hooks/use-action';
import type { Staff } from '@/lib/types';

export function EditStaffModal({
  staff,
  open,
  onOpenChange,
}: {
  staff: Staff;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    email: staff.email,
    firstName: staff.firstName ?? '',
    lastName: staff.lastName ?? '',
    phone: staff.phone ?? '',
  });

  const { run, pending, fieldErrors, clearFieldErrors } = useAction(updateStaff);

  useEffect(() => {
    if (open) {
      setForm({
        email: staff.email,
        firstName: staff.firstName ?? '',
        lastName: staff.lastName ?? '',
        phone: staff.phone ?? '',
      });
      clearFieldErrors();
    }
  }, [open, staff, clearFieldErrors]);

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
      title={`Edit ${staff.username}`}
      description="Update staff profile. To deactivate the staff member, use the actions menu."
      submitLabel="Save changes"
      pending={pending}
      onSubmit={async () => {
        const result = await run(staff.id, {
          email: form.email.trim(),
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          phone: form.phone.trim() || undefined,
        });
        if (result.ok) close(false);
      }}
    >
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

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="firstName"
          label="First name"
          maxLength={100}
          value={form.firstName}
          onChange={(v) => set('firstName', v)}
          error={fieldErrors.firstName}
        />
        <TextField
          name="lastName"
          label="Last name"
          maxLength={100}
          value={form.lastName}
          onChange={(v) => set('lastName', v)}
          error={fieldErrors.lastName}
        />
      </div>

      <TextField
        name="phone"
        label="Phone"
        maxLength={32}
        inputMode="tel"
        value={form.phone}
        onChange={(v) => set('phone', v)}
        error={fieldErrors.phone}
      />
    </FormModal>
  );
}
