'use client';

import { useEffect, useState, useTransition } from 'react';
import { CopyIcon, TicketIcon } from 'lucide-react';
import { toast } from 'sonner';

import {
  assignReferralCodes,
  loadProgramCodes,
  searchAssignableCustomers,
} from '@/app/(app)/referrals/actions';
import { FormModal } from '@/components/forms/form-modal';
import { TextField } from '@/components/forms/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAction } from '@/hooks/use-action';
import type { components } from '@/lib/api-schema';

type Code = components['schemas']['ReferralCodeResponseDto'];

interface Candidate {
  id: string;
  username: string;
  fullName: string | null;
}

/**
 * Issues referral codes to customers under a program.
 *
 * Bulk by design — the API takes up to 500 ids in one call and generates a
 * code each. Issuing one at a time would be both slower and a different
 * shape from how the API works.
 *
 * Customers who already hold a code under this program are shown as such
 * and cannot be selected again: the API would reject the duplicate, and a
 * greyed row with a reason is more use than a 422 afterwards.
 */
export function AssignCodesModal({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [existing, setExisting] = useState<Code[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxUses, setMaxUses] = useState('');
  const [searching, startSearch] = useTransition();

  const assign = useAction(assignReferralCodes);

  useEffect(() => {
    if (!open) return;
    loadProgramCodes(programId).then(setExisting).catch(console.error);
  }, [open, programId]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      startSearch(async () => setCandidates(await searchAssignableCustomers(query)));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  const alreadyIssued = new Map(existing.map((code) => [code.customerId, code]));

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableIds = candidates.filter((c) => !alreadyIssued.has(c.id)).map((c) => c.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const selectAll = () => setSelected((current) => new Set([...current, ...selectableIds]));
  const clearSelection = () => setSelected(new Set());

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSelected(new Set());
      setQuery('');
      setMaxUses('');
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <TicketIcon className="size-4" />
        Issue codes
      </Button>

      <FormModal
        open={open}
        onOpenChange={close}
        title={`Issue codes — ${programName}`}
        description="Each selected customer gets their own code and shareable link. Customers who already hold one under this program cannot be selected again."
        submitLabel={selected.size ? `Issue ${selected.size}` : 'Issue'}
        pending={assign.pending}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
        onSubmit={async () => {
          if (selected.size === 0) return;
          const result = await assign.run(programId, [...selected], {
            maxUses: maxUses ? Number(maxUses) : undefined,
          });
          if (result.ok) close(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="codeSearch">Find customers</Label>
            <Input
              id="codeSearch"
              value={query}
              placeholder="Search username, name, email…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <TextField
            name="maxUses"
            label="Max uses per code"
            inputMode="numeric"
            placeholder="Unlimited"
            value={maxUses}
            onChange={setMaxUses}
            hint="How many times one code may be redeemed."
          />
        </div>

        <div className="rounded-md border">
          <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-2 text-xs">
            <span>{searching ? 'Searching…' : `${candidates.length} shown`}</span>
            <div className="flex items-center gap-2">
              {selected.size > 0 ? (
                <Badge variant="secondary">{selected.size} selected</Badge>
              ) : null}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                disabled={selectableIds.length === 0 || allSelected}
                onClick={selectAll}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                disabled={selected.size === 0}
                onClick={clearSelection}
              >
                Clear
              </Button>
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              {searching ? 'Searching…' : 'No active customers match.'}
            </p>
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto">
              {candidates.map((candidate) => {
                const held = alreadyIssued.get(candidate.id);

                return (
                  <li key={candidate.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={`cand-${candidate.id}`}
                      checked={selected.has(candidate.id)}
                      disabled={Boolean(held)}
                      onCheckedChange={() => toggle(candidate.id)}
                    />
                    <label
                      htmlFor={`cand-${candidate.id}`}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <span className="block truncate text-sm font-medium">
                        {candidate.username}
                      </span>
                      {candidate.fullName ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {candidate.fullName}
                        </span>
                      ) : null}
                    </label>

                    {held ? (
                      <span className="flex items-center gap-1.5">
                        <code className="bg-muted tabular rounded px-1.5 py-0.5 text-xs">
                          {held.code}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Copy link for ${candidate.username}`}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(held.referralLink);
                              toast.success('Referral link copied.');
                            } catch {
                              toast.error('Could not copy. Select the text manually.');
                            }
                          }}
                        >
                          <CopyIcon className="size-3.5" />
                        </Button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected.size === 0 ? (
          <p className="text-muted-foreground text-xs">
            Select at least one customer. Existing code holders are shown with their code.
          </p>
        ) : null}

        {existing.length > 0 ? (
          <div className="rounded-md border">
            <div className="text-muted-foreground border-b px-3 py-2 text-xs">
              Already issued under this program ({existing.length})
            </div>
            <ul className="max-h-40 divide-y overflow-y-auto">
              {existing.map((code) => (
                <li key={code.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {code.customerUsername ?? '—'}
                  </span>
                  <code className="bg-muted tabular rounded px-1.5 py-0.5 text-xs">
                    {code.code}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Copy link for ${code.customerUsername ?? code.code}`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(code.referralLink);
                        toast.success('Referral link copied.');
                      } catch {
                        toast.error('Could not copy. Select the text manually.');
                      }
                    }}
                  >
                    <CopyIcon className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </FormModal>
    </>
  );
}
