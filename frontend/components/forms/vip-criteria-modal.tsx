'use client';

import { useState } from 'react';
import { PencilIcon, PlusIcon } from 'lucide-react';

import { VipCriteriaForm } from '@/components/forms/vip-criteria-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { VipCriteria } from '@/lib/types';

/**
 * Create or edit a VIP criteria without leaving the page.
 *
 * The criteria list sits directly above the qualifications it produces, so
 * navigating away to a separate form loses that context — the whole point
 * of having them on one page is seeing a threshold next to who currently
 * meets it.
 */
export function VipCriteriaModal({ criteria }: { criteria?: VipCriteria }) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(criteria);

  return (
    <>
      {editing ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Edit ${criteria?.name}`}
          onClick={() => setOpen(true)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" />
          New criteria
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit criteria' : 'New VIP criteria'}</DialogTitle>
            <DialogDescription>
              Qualification is computed from recorded activity against this threshold — it is never
              set by hand. Changing it takes effect on the next recompute.
            </DialogDescription>
          </DialogHeader>

          <VipCriteriaForm initialData={criteria} onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
