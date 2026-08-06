'use client';

import { useRouter } from 'next/navigation';

import { TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * A table row that navigates, without swallowing the controls inside it.
 *
 * Rows carry links, action menus and buttons. A naive `onClick` on the row
 * would fire when any of those are used — opening the detail page behind a
 * dropdown the user just clicked, or navigating away mid-confirmation. So
 * the handler ignores any event whose target sits inside an interactive
 * element.
 *
 * Keyboard and middle-click still work because the row is not the only way
 * in: the first cell keeps a real `<a>`. This is an enlargement of the hit
 * area, not a replacement for the link — a row with no link in it would be
 * unreachable by keyboard and invisible to a screen reader.
 */
const INTERACTIVE = 'a, button, input, select, textarea, [role="menuitem"], [role="button"]';

export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <TableRow
      className={cn('hover:bg-muted/50 cursor-pointer transition-colors', className)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
        router.push(href);
      }}
      onAuxClick={(event) => {
        // Middle-click opens in a new tab, matching what the row's own link
        // would do.
        if (event.button !== 1) return;
        if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
        window.open(href, '_blank', 'noopener');
      }}
    >
      {children}
    </TableRow>
  );
}
