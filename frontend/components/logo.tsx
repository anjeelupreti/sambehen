import { cn } from '@/lib/utils';

/**
 * The Howdi chat logo: a monogram and the wordmark, set in Archivo.
 *
 * The monogram is the H in a speech-bubble tile: a rounded square with one
 * square corner, the same shape as the last bubble in a chat group. The
 * favicon and app icons in /app are rendered from this same design.
 *
 * `site` uses the public pages' fixed light palette; `app` follows the
 * app theme.
 */
export function Logo({
  tone = 'app',
  size = 'md',
  className,
}: {
  tone?: 'app' | 'site';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const accent = tone === 'site' ? 'text-lp-primary' : 'text-primary';
  const tile = tone === 'site' ? 'bg-lp-primary text-white' : 'bg-primary text-primary-foreground';

  return (
    <span className={cn('font-lp inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center rounded-[30%] rounded-bl-[8%] leading-none font-extrabold [font-stretch:112%]',
          tile,
          size === 'sm' ? 'size-6 text-[13px]' : 'size-7 text-[15px]',
        )}
      >
        H
      </span>
      <span
        className={cn(
          'leading-none font-extrabold tracking-tight whitespace-nowrap [font-stretch:125%]',
          size === 'sm' ? 'text-base' : 'text-lg',
        )}
      >
        Howdi
        <span className={cn('ml-1 font-medium [font-stretch:100%]', accent)}>chat</span>
      </span>
    </span>
  );
}
