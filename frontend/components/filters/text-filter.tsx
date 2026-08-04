'use client';

import { useEffect, useState } from 'react';

import { useFilterParams } from '@/hooks/use-filter-params';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * A free-text filter on one parameter, applied on submit.
 *
 * Deliberately not debounced like the search field: this sits behind a
 * popover, so there is a natural commit point, and firing a request per
 * keystroke on a filter nobody is watching wastes round trips.
 */
export function TextFilter({
  param,
  label,
  icon,
  placeholder,
  maxLength = 120,
}: {
  param: string;
  label: string;
  /**
   * A rendered element, not a component. These filters are declared in
   * Server Components, and a component reference cannot cross the RSC
   * boundary — a lucide icon is a forwardRef object and fails to
   * serialise. An already-rendered element serialises fine.
   */
  icon: React.ReactNode;
  placeholder?: string;
  maxLength?: number;
}) {
  const { get, setParam } = useFilterParams();

  const current = get(param);
  const [draft, setDraft] = useState(current ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => setDraft(current ?? ''), [current]);

  const apply = () => {
    setParam(param, draft.trim() || undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={current ? 'secondary' : 'outline'} size="sm" className="gap-2">
          {icon}
          <span className="max-w-28 truncate">{current ?? label}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-60 space-y-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
          className="space-y-3"
        >
          <Input
            autoFocus
            value={draft}
            maxLength={maxLength}
            placeholder={placeholder ?? label}
            aria-label={label}
            onChange={(event) => setDraft(event.target.value)}
          />

          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1">
              Apply
            </Button>
            {current ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setParam(param, undefined);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
