/* eslint-disable @next/next/no-img-element -- small avatars, already sized and compressed */
import { initials } from './format';
import { cn } from '@/lib/utils';

/**
 * A person's avatar: their photo when there is one, their initials when
 * there isn't, with an online dot when presence is known. The dot is a
 * visual cue only; headers and lists say "Online" in words.
 */
export function ChatAvatar({
  name,
  src,
  online,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  online?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'bg-primary/12 text-accent-foreground relative inline-grid shrink-0 place-items-center rounded-full font-semibold',
        size === 'xs' && 'size-7 text-[11px]',
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-10 text-sm',
        size === 'lg' && 'size-11 text-sm',
        size === 'xl' && 'size-16 text-lg',
        className,
      )}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="size-full rounded-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
      {online && (
        <span className="bg-success ring-background absolute right-0 bottom-0 size-2.5 rounded-full ring-2" />
      )}
    </span>
  );
}
