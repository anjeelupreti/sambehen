'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';

/**
 * Debounced search bound to the `search` query parameter.
 *
 * Resets to page 1 on every change: staying on page 7 of a narrower result
 * set usually lands on an empty page, which reads as "no matches" when
 * there are plenty.
 */
export function SearchField({ placeholder = 'Search…' }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get('search') ?? '';
  const [value, setValue] = useState(current);

  // Keeps the field in step when navigation changes the URL from elsewhere
  // — a cleared filter, or the back button.
  useEffect(() => {
    setValue(current);
  }, [current]);

  useEffect(() => {
    if (value === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (value) params.set('search', value);
      else params.delete('search');
      params.delete('page');

      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    }, 300);

    return () => clearTimeout(timer);
  }, [value, current, pathname, router, searchParams]);

  return (
    <div className="relative max-w-sm flex-1">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}
