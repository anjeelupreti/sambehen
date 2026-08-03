'use client';

import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';

import { useFilterParams } from '@/hooks/use-filter-params';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * A column header that sorts through `sortBy` / `sortOrder`.
 *
 * Cycles descending → ascending → unsorted. Descending comes first because
 * for every sortable column here — amount, spend, last activity — the
 * interesting end is the top one.
 *
 * `aria-sort` is set so the state is available to screen readers; the arrow
 * alone conveys it only visually.
 */
export function SortableHeader({
  column,
  children,
  className,
  align = 'left',
}: {
  column: string;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}) {
  const { get, setMany } = useFilterParams();

  const activeColumn = get('sortBy');
  const order = get('sortOrder');
  const isActive = activeColumn === column;

  const next = () => {
    if (!isActive) return setMany({ sortBy: column, sortOrder: 'desc' });
    if (order === 'desc') return setMany({ sortBy: column, sortOrder: 'asc' });
    return setMany({ sortBy: undefined, sortOrder: undefined });
  };

  const Icon = !isActive ? ChevronsUpDownIcon : order === 'asc' ? ArrowUpIcon : ArrowDownIcon;

  return (
    <TableHead
      className={cn(align === 'right' && 'text-right', className)}
      aria-sort={!isActive ? 'none' : order === 'asc' ? 'ascending' : 'descending'}
    >
      <button
        type="button"
        onClick={next}
        className={cn(
          'hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
          align === 'right' && 'flex-row-reverse',
          isActive ? 'text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        {children}
        <Icon className={cn('size-3.5 shrink-0', !isActive && 'opacity-50')} />
      </button>
    </TableHead>
  );
}
