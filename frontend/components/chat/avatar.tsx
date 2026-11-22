import { initials } from './format';
import { cn } from '@/lib/utils';

/**
 * Initials avatar, with an online dot when presence is known. The dot is a
 * visual cue only; the header and list say "Online" in words.
 */
export function ChatAvatar({
  name,
  online,
  size = 'md',
}: {
  name: string;
  online?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      className={cn(
        'bg-primary/12 text-accent-foreground relative inline-grid shrink-0 place-items-center rounded-full font-semibold',
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-10 text-sm',
        size === 'lg' && 'size-11 text-sm',
      )}
      aria-hidden
    >
      {initials(name)}
      {online && (
        <span className="bg-success ring-background absolute right-0 bottom-0 size-2.5 rounded-full ring-2" />
      )}
    </span>
  );
}
