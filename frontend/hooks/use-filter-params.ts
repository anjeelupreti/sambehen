'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Reads and writes list filters through the URL.
 *
 * Filter state lives in the query string rather than in component state for
 * three reasons: a filtered view is a shareable link, the back button undoes
 * a filter the way users expect, and the Server Component re-runs its query
 * on navigation without any client-side refetching.
 *
 * Every write resets `page`. Staying on page 7 while narrowing the result
 * set usually lands on an empty page, which reads as "no matches" when there
 * are in fact plenty on page 1.
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const get = useCallback((key: string) => searchParams.get(key) ?? undefined, [searchParams]);

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void, options?: { keepPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      if (!options?.keepPage) params.delete('page');

      const query = params.toString();
      startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
    },
    [pathname, router, searchParams],
  );

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      commit((params) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
    },
    [commit],
  );

  const setMany = useCallback(
    (values: Record<string, string | undefined>) => {
      commit((params) => {
        for (const [key, value] of Object.entries(values)) {
          if (value) params.set(key, value);
          else params.delete(key);
        }
      });
    },
    [commit],
  );

  /** Clears filters but keeps sort — clearing a search should not also reorder the table. */
  const clearAll = useCallback(
    (keys: string[]) => {
      commit((params) => {
        for (const key of keys) params.delete(key);
      });
    },
    [commit],
  );

  const setPage = useCallback(
    (page: number) => {
      commit((params) => params.set('page', String(page)), { keepPage: true });
    },
    [commit],
  );

  return { get, setParam, setMany, clearAll, setPage, pending, searchParams };
}
