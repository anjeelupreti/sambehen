'use client';

import { useEffect, useState, useTransition } from 'react';
import { CheckIcon, Loader2Icon, SearchIcon } from 'lucide-react';

import { searchCustomers } from '@/app/(app)/transactions/actions';
import { FormField } from '@/components/forms/form-field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Match {
  id: string;
  username: string;
  fullName: string | null;
}

/**
 * Search-and-pick for the customer an entry belongs to.
 *
 * A free-text uuid field would be unusable and a full dropdown of every
 * customer does not scale past a few hundred, so this searches the scoped
 * list — a runner can only ever find their own customers, because the API
 * applies the same predicate here as everywhere else.
 *
 * Once chosen, the selection is shown as a confirmed row rather than left
 * as text in the box: recording money against the wrong customer is the
 * expensive mistake this form can make.
 */
export function CustomerPicker({
  value,
  onChange,
  error,
}: {
  value: Match | null;
  onChange: (customer: Match | null) => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (value) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMatches([]);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => setMatches(await searchCustomers(trimmed)));
    }, 250);

    return () => clearTimeout(timer);
  }, [query, value]);

  if (value) {
    return (
      <FormField name="customer" label="Customer" error={error} required>
        {() => (
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <CheckIcon className="size-4 shrink-0 text-green-600 dark:text-green-500" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{value.username}</span>
                {value.fullName ? (
                  <span className="text-muted-foreground block truncate text-xs">
                    {value.fullName}
                  </span>
                ) : null}
              </span>
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline"
              onClick={() => {
                onChange(null);
                setQuery('');
              }}
            >
              Change
            </button>
          </div>
        )}
      </FormField>
    );
  }

  return (
    <FormField
      name="customer"
      label="Customer"
      error={error}
      hint="Type at least two characters to search."
      required
    >
      {(props) => (
        <div className="space-y-1.5">
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              {...props}
              value={query}
              placeholder="Search username, name, email…"
              className="pr-8 pl-9"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
            {pending ? (
              <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
            ) : null}
          </div>

          {query.trim().length >= 2 && !pending && matches.length === 0 ? (
            <p className="text-muted-foreground px-1 text-xs">No active customers match.</p>
          ) : null}

          {matches.length > 0 ? (
            <ul className="max-h-44 overflow-y-auto rounded-md border">
              {matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => onChange(match)}
                    className={cn(
                      'hover:bg-accent flex w-full flex-col items-start px-3 py-2 text-left transition-colors',
                    )}
                  >
                    <span className="text-sm font-medium">{match.username}</span>
                    {match.fullName ? (
                      <span className="text-muted-foreground text-xs">{match.fullName}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </FormField>
  );
}
