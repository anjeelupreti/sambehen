import { cn } from '@/lib/utils';
import { formatMoney, isNegative } from '@/lib/money';

/**
 * Renders a money value from the API.
 *
 * Takes the raw string and formats it for display only. Right-aligned and
 * tabular so a column of figures lines up digit for digit — a misplaced
 * decimal is then visible without reading the numbers.
 */
export function Money({
  value,
  className,
  showCurrency = true,
  muted = false,
}: {
  value: string | null | undefined;
  className?: string;
  showCurrency?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        'tabular tracking-tight',
        muted && 'text-muted-foreground',
        isNegative(value) && 'text-destructive',
        className,
      )}
    >
      {formatMoney(value, { showCurrency })}
    </span>
  );
}
