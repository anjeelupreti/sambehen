import { CrownIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ChipLabel {
  id: string;
  name: string;
  color: string;
}

/** Each palette name the API allows, as a soft chip that reads in light and dark. */
export const LABEL_STYLES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
  purple: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  gray: 'bg-muted text-muted-foreground',
};

export const LABEL_DOTS: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-violet-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
  gray: 'bg-muted-foreground',
};

/** Automatic labels in the order they matter most when space is short. */
const AUTO: Record<string, { name: string; className: string }> = {
  vip: { name: 'VIP', className: 'bg-highlight text-highlight-foreground' },
  big_spender: {
    name: 'Big spender',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  new: {
    name: 'New',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
  },
  inactive: { name: 'Inactive', className: 'bg-muted text-muted-foreground' },
};

export const AUTO_LABEL_NAMES = Object.fromEntries(
  Object.entries(AUTO).map(([key, value]) => [key, value.name]),
);

/**
 * A player's labels as small chips: automatic ones first (VIP, big
 * spender, new, inactive), then the operator's own. `max` keeps rows tidy,
 * folding the rest into "+N".
 */
export function LabelChips({
  labels = [],
  autoLabels = [],
  max,
  size = 'sm',
  className,
  onRemove,
}: {
  labels?: ChipLabel[];
  autoLabels?: string[];
  max?: number;
  size?: 'xs' | 'sm';
  className?: string;
  /** Shows a remove button on the operator's own labels. */
  onRemove?: (labelId: string) => void;
}) {
  const chips = [
    ...Object.keys(AUTO)
      .filter((key) => autoLabels.includes(key))
      .map((key) => ({
        key,
        name: AUTO[key].name,
        className: AUTO[key].className,
        vip: key === 'vip',
        removable: false,
      })),
    ...labels.map((label) => ({
      key: label.id,
      name: label.name,
      className: LABEL_STYLES[label.color] ?? LABEL_STYLES.gray,
      vip: false,
      removable: true,
    })),
  ];
  if (!chips.length) return null;
  const shown = max ? chips.slice(0, max) : chips;
  const hidden = chips.length - shown.length;
  const chipClass = cn(
    'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap',
    size === 'xs' ? 'h-[18px] px-1.5 text-[10px]' : 'h-6 px-2 text-xs',
  );

  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
      {shown.map((chip) => (
        <span key={chip.key} className={cn(chipClass, chip.className)}>
          {chip.vip && <CrownIcon className={size === 'xs' ? 'size-2.5' : 'size-3'} aria-hidden />}
          {chip.name}
          {onRemove && chip.removable && (
            <button
              type="button"
              onClick={() => onRemove(chip.key)}
              aria-label={`Remove ${chip.name}`}
              className="-mr-1 grid size-4 place-items-center rounded-full opacity-70 outline-none hover:bg-black/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/15"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </span>
      ))}
      {hidden > 0 && (
        <span className={cn(chipClass, 'bg-muted text-muted-foreground')}>+{hidden}</span>
      )}
    </span>
  );
}
