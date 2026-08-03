'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon, SearchIcon, XIcon } from 'lucide-react';

import { useFilterParams } from '@/hooks/use-filter-params';
import { Input } from '@/components/ui/input';

/**
 * Debounced search bound to the `search` query parameter.
 *
 * The 300ms debounce leaves the field ahead of the results for a moment on
 * every keystroke. The spinner makes that gap legible — without it a slow
 * query is indistinguishable from a search that returned nothing.
 */
export function SearchField({
  placeholder = 'Search…',
  param = 'search',
}: {
  placeholder?: string;
  param?: string;
}) {
  const { get, setParam, pending } = useFilterParams();

  const current = get(param) ?? '';
  const [value, setValue] = useState(current);

  // Keeps the field in step when navigation changes the URL from elsewhere
  // — a cleared chip, or the back button.
  useEffect(() => {
    setValue(current);
  }, [current]);

  useEffect(() => {
    if (value === current) return;
    const timer = setTimeout(() => setParam(param, value || undefined), 300);
    return () => clearTimeout(timer);
  }, [value, current, param, setParam]);

  const settling = pending || value !== current;

  return (
    <div className="relative w-full min-w-0 sm:max-w-xs">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />

      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="h-8 pr-8 pl-9"
        aria-label={placeholder}
      />

      <div className="absolute top-1/2 right-2 -translate-y-1/2">
        {settling ? (
          <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
        ) : value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm p-0.5 transition-colors"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
