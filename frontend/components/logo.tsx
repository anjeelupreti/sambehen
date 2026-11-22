/* eslint-disable @next/next/no-img-element -- small static brand files; next/image adds nothing here */
import { cn } from '@/lib/utils';

/**
 * The Howdi chat logo: the hat-wearing chat bubble and the wordmark, set in
 * Archivo. The mark's navy hat disappears on dark backgrounds, so the app
 * swaps in a light-hat version in dark mode. The public pages are always
 * light. Favicon and app icons in /app are cut from the same artwork.
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
  const mark = size === 'sm' ? 'size-7' : 'size-8';

  return (
    <span className={cn('font-lp inline-flex items-center gap-2', className)}>
      {tone === 'site' ? (
        <img src="/brand/logo-mark.png" alt="" className={cn(mark, 'shrink-0')} />
      ) : (
        <>
          <img src="/brand/logo-mark.png" alt="" className={cn(mark, 'shrink-0 dark:hidden')} />
          <img
            src="/brand/logo-mark-dark.png"
            alt=""
            className={cn(mark, 'hidden shrink-0 dark:block')}
          />
        </>
      )}
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
