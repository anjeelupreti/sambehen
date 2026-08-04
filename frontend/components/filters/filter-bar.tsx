'use client';

import { XIcon } from 'lucide-react';

import { useFilterParams } from '@/hooks/use-filter-params';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ActiveFilterSpec {
  /** Query parameter this chip clears. */
  param: string;
  label: string;
  /**
   * Display text for raw values, when the stored value is not what a human
   * should read — `isActive=true` shows as "Recent".
   *
   * A lookup rather than a formatting function on purpose: these specs are
   * declared in Server Components and handed to this Client Component, and
   * a function cannot cross that boundary.
   */
  labels?: Record<string, string>;
}

/**
 * Wraps a page's filter controls and reports what is currently applied.
 *
 * The chips are the important part. Without them a filter set on one visit
 * and forgotten silently narrows every later view of the page, and an empty
 * table reads as "there is no data" rather than "you filtered it away".
 * Each chip removes exactly one filter; "Clear all" removes them together.
 */
export function FilterBar({
  children,
  active,
  className,
}: {
  children: React.ReactNode;
  active: ActiveFilterSpec[];
  className?: string;
}) {
  const { get, setParam, clearAll } = useFilterParams();

  const applied = active
    .map((spec) => ({ ...spec, value: get(spec.param) }))
    .filter((spec): spec is ActiveFilterSpec & { value: string } => Boolean(spec.value));

  return (
    <div className={cn('space-y-3 p-3', className)}>
      <div className="flex flex-wrap items-center gap-2">{children}</div>

      {applied.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Filtered by</span>

          {applied.map((spec) => (
            <Badge key={spec.param} variant="secondary" className="gap-1 pr-1 font-normal">
              <span className="text-muted-foreground">{spec.label}:</span>
              <span className="max-w-40 truncate">{spec.labels?.[spec.value] ?? spec.value}</span>
              <button
                type="button"
                onClick={() => setParam(spec.param, undefined)}
                aria-label={`Remove ${spec.label} filter`}
                className="hover:bg-muted-foreground/20 ml-0.5 rounded-sm p-0.5 transition-colors"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => clearAll(active.map((spec) => spec.param))}
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
