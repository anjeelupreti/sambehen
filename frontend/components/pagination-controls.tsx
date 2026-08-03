'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatCount } from '@/lib/money';
import type { PaginationMeta } from '@/lib/types';

/**
 * Page controls driven by the URL.
 *
 * Paging writes to the query string rather than to component state, so a
 * page of results is a shareable link and the back button behaves. The
 * Server Component re-runs the query on navigation.
 */
export function PaginationControls({ meta }: { meta: PaginationMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-3">
      <p className="text-muted-foreground text-sm">
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

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasPreviousPage}
          onClick={() => goToPage(meta.page - 1)}
        >
          <ChevronLeftIcon />
          Previous
        </Button>
        <span className="text-muted-foreground text-sm">
          Page <span className="tabular">{meta.page}</span> of{' '}
          <span className="tabular">{Math.max(meta.totalPages, 1)}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasNextPage}
          onClick={() => goToPage(meta.page + 1)}
        >
          Next
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
