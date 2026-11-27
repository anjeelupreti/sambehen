'use client';

import { InfoIcon } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * A small "i" that explains something on demand, so the screen itself
 * stays free of help text. A popover rather than a tooltip: it has to open
 * on a tap, too.
 */
export function InfoTip({
  children,
  label = 'More info',
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          'text-muted-foreground hover:text-foreground focus-visible:ring-ring/70 inline-grid size-5 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px]',
          className,
        )}
      >
        <InfoIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-3 text-xs leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
