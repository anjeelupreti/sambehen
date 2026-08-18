'use client';

import { useRef, useState } from 'react';
import { DownloadIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';

import { commitCustomerImport, previewCustomerImport } from '@/app/(app)/customers/actions';
import type { AssignableOwner } from '@/components/forms/new-customer-modal';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAction } from '@/hooks/use-action';
import type { ImportPreview, StaffRole } from '@/lib/types';

/**
 * Bulk customer import.
 *
 * Two steps, matching the API: a file is parsed and shown back — nothing is
 * written yet — then the operator ticks off which rows to keep and commits.
 * Every valid row starts ticked; a row with a problem is shown so the file
 * can be fixed, but it is never selectable because it was never returned as
 * importable in the first place.
 */
export function ImportCustomersModal({
  actorRole,
  owners,
}: {
  actorRole: StaffRole;
  owners: AssignableOwner[];
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [password, setPassword] = useState('');
  const [ownerStaffId, setOwnerStaffId] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const needsOwner = actorRole === 'master';
  const canChooseOwner = actorRole !== 'store';

  const parse = useAction(previewCustomerImport);
  const commit = useAction(commitCustomerImport);
  const pending = parse.pending || commit.pending;

  const reset = () => {
    setPreview(null);
    setTicked(new Set());
    setPassword('');
    setOwnerStaffId('');
    parse.clearFieldErrors();
    commit.clearFieldErrors();
    if (fileInput.current) fileInput.current.value = '';
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await parse.run(file);
    if (result.ok && result.data) {
      setPreview(result.data);
      setTicked(new Set(result.data.valid.map((row) => row.rowNumber)));
    }
  };

  const toggle = (rowNumber: number) => {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const ready = Boolean(
    preview && ticked.size > 0 && password.trim() && (!needsOwner || ownerStaffId),
  );

  // Collisions raised at commit time, keyed like `row.7` — the rare case
  // where a row that was importable during preview no longer is because
  // someone else's write landed in between.
  const rowErrors = Object.entries(commit.fieldErrors).filter(([key]) => key.startsWith('row.'));

  const handleCommit = async () => {
    if (!preview || !ready) return;
    const rows = preview.valid.filter((row) => ticked.has(row.rowNumber));
    const result = await commit.run(rows, password, ownerStaffId || undefined);
    if (result.ok) close(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <DownloadIcon className="size-4" />
        Import
      </Button>

      <Dialog open={open} onOpenChange={pending ? undefined : close}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import customers</DialogTitle>
            <DialogDescription>
              {preview
                ? 'Rows with a problem are shown but cannot be imported — fix the file and re-upload to include them.'
                : 'An .xlsx file with email and username columns. Full name, phone, city and country are optional. Nothing is written until you confirm below.'}
            </DialogDescription>
          </DialogHeader>

          {!preview ? (
            <div className="space-y-4">
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={parse.pending}
                onChange={(event) => handleFile(event.target.files?.[0])}
                className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50"
              />
              {parse.pending ? (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2Icon className="size-4 animate-spin" />
                  Parsing…
                </p>
              ) : null}
              {parse.fieldErrors.file ? (
                <p className="text-destructive text-sm">{parse.fieldErrors.file}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="default">{preview.valid.length} importable</Badge>
                {preview.issues.length > 0 ? (
                  <Badge variant="destructive">{preview.issues.length} with a problem</Badge>
                ) : null}
                <span className="text-muted-foreground">of {preview.totalRows} rows</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="ml-auto h-auto p-0"
                  onClick={reset}
                >
                  Choose a different file
                </Button>
              </div>

              {preview.valid.length > 0 ? (
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <span className="sr-only">Include</span>
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.valid.map((row) => (
                        <TableRow key={row.rowNumber}>
                          <TableCell>
                            <Checkbox
                              checked={ticked.has(row.rowNumber)}
                              onCheckedChange={() => toggle(row.rowNumber)}
                              aria-label={`Include row ${row.rowNumber}`}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{row.email}</TableCell>
                          <TableCell className="text-sm">{row.username}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.fullName ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No row in this file can be imported as-is.
                </p>
              )}

              {preview.issues.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <TriangleAlertIcon className="size-4" />
                    Rows that will be skipped
                  </p>
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                    {preview.issues.map((issue, index) => (
                      <li key={index} className="text-muted-foreground">
                        Row {issue.rowNumber}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rowErrors.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-destructive text-sm font-medium">
                    Nothing was imported — these rows now conflict:
                  </p>
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                    {rowErrors.map(([key, message]) => (
                      <li key={key} className="text-destructive">
                        {message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="password"
                  label="Password for every imported customer"
                  required
                  type="password"
                  value={password}
                  onChange={setPassword}
                  error={commit.fieldErrors.password}
                  hint="They cannot change it themselves — staff do."
                />
                {canChooseOwner ? (
                  <SelectField
                    name="ownerStaffId"
                    label="Owned by"
                    required={needsOwner}
                    value={ownerStaffId}
                    onChange={setOwnerStaffId}
                    options={owners.map((owner) => ({
                      value: owner.id,
                      label: `${owner.username} · ${owner.role}`,
                    }))}
                    placeholder={needsOwner ? 'Choose a manager or store' : 'Keep for myself'}
                    error={commit.fieldErrors.ownerStaffId}
                  />
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => close(false)}>
              Cancel
            </Button>
            {preview ? (
              <Button type="button" disabled={!ready || pending} onClick={handleCommit}>
                {commit.pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {commit.pending ? 'Importing…' : `Import ${ticked.size}`}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
