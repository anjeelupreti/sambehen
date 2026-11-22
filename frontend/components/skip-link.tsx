/**
 * The first stop for a keyboard user: jumps past the navigation to the
 * page's content. Hidden until focused.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="bg-primary text-primary-foreground focus-visible:ring-ring/70 sr-only z-50 rounded-lg px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-[3px]"
    >
      Skip to content
    </a>
  );
}
