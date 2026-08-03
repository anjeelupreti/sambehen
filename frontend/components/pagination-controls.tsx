'use client';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';

import { useFilterParams } from '@/hooks/use-filter-params';
import { Button } from '@/components/ui/button';
import { formatCount } from '@/lib/money';
import type { PaginationMeta } from '@/lib/types';

/**
 * Page controls driven by the URL.
 *
 * Paging writes to the query string rather than to component state, so a
 * page of results is a shareable link and the back button behaves. The
 * Server Component re-runs the query on navigation.
 *
 * First/last jumps are hidden below `sm`: six controls plus the counts do
 * not fit a phone width without wrapping into an unusable row.
 */
export function PaginationControls({ meta }: { meta: PaginationMeta }) {
  const { setPage, pending } = useFilterParams();

  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);
  const totalPages = Math.max(meta.totalPages, 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {meta.total === 0 ? (
          'No results'
        ) : (
          <>
            Showing <span className="tabular font-medium">{formatCount(first)}</span>–
            <span className="tabular font-medium">{formatCount(last)}</span> of{' '}
            <span className="tabular font-medium">{formatCount(meta.total)}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          disabled={!meta.hasPreviousPage || pending}
          onClick={() => setPage(1)}
          aria-label="First page"
        >
          <ChevronsLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={!meta.hasPreviousPage || pending}
          onClick={() => setPage(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon />
        </Button>

        <span className="text-muted-foreground px-2 text-sm whitespace-nowrap">
          Page <span className="tabular text-foreground font-medium">{meta.page}</span> of{' '}
          <span className="tabular">{formatCount(totalPages)}</span>
        </span>

        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={!meta.hasNextPage || pending}
          onClick={() => setPage(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="hidden size-8 sm:inline-flex"
          disabled={!meta.hasNextPage || pending}
          onClick={() => setPage(totalPages)}
          aria-label="Last page"
        >
          <ChevronsRightIcon />
        </Button>
      </div>
    </div>
  );
}
