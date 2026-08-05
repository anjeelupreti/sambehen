'use client';

import { useState, useEffect } from 'react';
import { updateGame } from '@/app/(app)/games/actions';
import { FormModal } from '@/components/forms/form-modal';
import { TextField } from '@/components/forms/form-field';
import { useAction } from '@/hooks/use-action';
import { Label } from '@/components/ui/label';
import type { Game } from '@/lib/types';

export function EditGameModal({
  game,
  open,
  onOpenChange,
}: {
  game: Game;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    name: game.name,
    category: game.category ?? '',
    description: game.description ?? '',
    imageUrl: game.imageUrl ?? '',
    isActive: game.isActive,
  });

  const { run, pending, fieldErrors, clearFieldErrors } = useAction(updateGame);

  useEffect(() => {
    if (open) {
      setForm({
        name: game.name,
        category: game.category ?? '',
        description: game.description ?? '',
        imageUrl: game.imageUrl ?? '',
        isActive: game.isActive,
      });
      clearFieldErrors();
    }
  }, [open, game, clearFieldErrors]);

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
      title={`Edit ${game.code}`}
      description="Update game details. Deactivating a game prevents new transactions but preserves historical data."
      submitLabel="Save changes"
      className="sm:max-w-2xl"
      pending={pending}
      onSubmit={async () => {
        const result = await run(game.id, {
          name: form.name.trim() || undefined,
          category: form.category.trim() || undefined,
          description: form.description.trim() || undefined,
          imageUrl: form.imageUrl.trim() || undefined,
          isActive: form.isActive,
        });
        if (result.ok) close(false);
      }}
    >
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

      <div className="flex items-center space-x-2 mt-2">
        <input
          type="checkbox"
          id="isActive"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
          className="size-4"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </FormModal>
  );
}
