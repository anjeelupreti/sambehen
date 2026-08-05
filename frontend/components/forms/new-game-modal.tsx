'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';

import { createGame } from '@/app/(app)/games/actions';
import { FormModal } from '@/components/forms/form-modal';
import { TextField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { useAction } from '@/hooks/use-action';
import type { StaffRole } from '@/lib/types';

const EMPTY = {
  name: '',
  code: '',
  category: '',
  description: '',
  imageUrl: '',
};

export function NewGameModal({ actorRole }: { actorRole: StaffRole }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { run, pending, fieldErrors, clearFieldErrors } = useAction(createGame);

  const canCreate = actorRole === 'master';

  if (!canCreate) return null;

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
        <PlusIcon className="size-4" />
        New game
      </Button>

      <FormModal
        open={open}
        onOpenChange={close}
        title="New game"
        description="Add a new game to the system. The game code is used as a unique identifier for imports and exports."
        submitLabel="Create game"
        className="sm:max-w-2xl"
        pending={pending}
        onSubmit={async () => {
          const result = await run({
            name: form.name.trim(),
            code: form.code.trim().toUpperCase(),
            category: form.category.trim() || undefined,
            description: form.description.trim() || undefined,
            imageUrl: form.imageUrl.trim() || undefined,
          });
          if (result.ok) close(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="name"
            label="Name"
            required
            autoFocus
            maxLength={150}
            value={form.name}
            onChange={(v) => set('name', v)}
            error={fieldErrors.name}
          />
          <TextField
            name="code"
            label="Code"
            required
            maxLength={50}
            value={form.code}
            onChange={(v) => set('code', v.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase())}
            error={fieldErrors.code}
            hint="Uppercase letters, digits, underscore, and hyphen only."
          />
        </div>

        <TextField
          name="category"
          label="Category"
          maxLength={80}
          value={form.category}
          onChange={(v) => set('category', v)}
          error={fieldErrors.category}
          hint="e.g. slots, table, live, sports, lottery, arcade"
        />

        <div className="grid gap-2">
          <label className="text-sm font-medium leading-none">Game Image</label>
          <div className="flex items-center gap-4">
            {form.imageUrl ? (
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="Preview" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                <span className="text-xs text-muted-foreground">No image</span>
              </div>
            )}
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <input
                type="file"
                accept="image/*"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    const res = await fetch('/api/upload', { method: 'POST', body: formData });
                    if (!res.ok) throw new Error('Upload failed');
                    const data = await res.json();
                    set('imageUrl', data.url);
                  } catch (err) {
                    console.error(err);
                  }
                }}
              />
              <p className="text-[0.8rem] text-muted-foreground">
                Upload a game cover image (PNG, JPG).
              </p>
              {fieldErrors.imageUrl && (
                <p className="text-[0.8rem] font-medium text-destructive">{fieldErrors.imageUrl}</p>
              )}
            </div>
          </div>
        </div>

        <TextField
          name="description"
          label="Description"
          maxLength={1000}
          value={form.description}
          onChange={(v) => set('description', v)}
          error={fieldErrors.description}
        />
      </FormModal>
    </>
  );
}
