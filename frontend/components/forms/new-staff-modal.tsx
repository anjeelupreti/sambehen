'use client';

import { useState } from 'react';
import { UserPlusIcon } from 'lucide-react';

import { createStaff } from '@/app/(app)/staff/actions';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';
import type { StaffRole } from '@/lib/types';

const EMPTY = {
  username: '',
  email: '',
  password: '',
  role: 'store' as 'manager' | 'store',
  parentId: '',
  firstName: '',
  lastName: '',
  phone: '',
};

export interface ParentManager {
  id: string;
  username: string;
}

/**
 * Creates a manager or a store.
 *
 * A manager can only create stores, and those stores land beneath them —
 * so the role control is not offered at all rather than shown and then
 * rejected by the API. Master is never creatable from here.
 *
 * The team is a two-level chain, so **a store must sit under a manager**.
 * When a master creates one there is no implied parent, and the API answers
 * `STAFF_INVALID_HIERARCHY`; the manager is therefore asked for rather than
 * left to fail. A manager creating a store is the implied parent already.
 */
export function NewStaffModal({
  actorRole,
  managers,
}: {
  actorRole: StaffRole;
  managers: ParentManager[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { run, pending, fieldErrors, clearFieldErrors } = useAction(createStaff);

  const needsParent = actorRole === 'master' && form.role === 'store';

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
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
        New staff
      </Button>

      <FormModal
        open={open}
        onOpenChange={close}
        title="New staff member"
        description={
          actorRole === 'master'
            ? 'Managers see their own chain; stores see only their own customers.'
            : 'Stores you create work under you and see only their own customers.'
        }
        submitLabel="Create staff member"
        pending={pending}
        onSubmit={async () => {
          const result = await run({
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            // A manager can only ever create a store beneath themselves,
            // so the role is fixed rather than trusted from state.
            role: actorRole === 'master' ? form.role : 'store',
            // Only meaningful for a master placing a store; in every other
            // case the API derives the parent from the caller.
            parentId: needsParent ? form.parentId || undefined : undefined,
            firstName: form.firstName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            phone: form.phone.trim() || undefined,
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

        {actorRole === 'master' ? (
          <SelectField
            name="role"
            label="Role"
            required
            value={form.role}
            onChange={(v) => set('role', v as 'manager' | 'store')}
            options={[
              { value: 'manager', label: 'Manager — sees their own chain' },
              { value: 'store', label: 'Store — sees only their own customers' },
            ]}
            error={fieldErrors.role}
          />
        ) : null}

        {needsParent ? (
          <SelectField
            name="parentId"
            label="Reports to"
            required
            value={form.parentId}
            onChange={(v) => set('parentId', v)}
            options={managers.map((manager) => ({ value: manager.id, label: manager.username }))}
            placeholder="Choose a manager"
            error={fieldErrors.parentId}
            hint="Stores sit under a manager. Their customers are visible to that manager."
          />
        ) : null}

        <TextField
          name="password"
          label="Password"
          required
          type="password"
          maxLength={128}
          value={form.password}
          onChange={(v) => set('password', v)}
          error={fieldErrors.password}
          hint="They can be given a new one from the row menu at any time."
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
    </>
  );
}
