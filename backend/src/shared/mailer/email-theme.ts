/**
 * shadcn/ui design tokens, resolved to hex for email.
 *
 * The frontend will use shadcn, so these mirror its default (slate) light
 * theme variables one-for-one. Keeping the two in step means a customer
 * moving from an email to the app sees the same product rather than two
 * that merely share a name.
 *
 * Values are hex rather than the `hsl(var(--token))` form shadcn uses in
 * CSS, because email clients do not support CSS custom properties and
 * several still mishandle `hsl()`. Each entry names the variable it comes
 * from so the two can be reconciled when the palette changes.
 */
export const SHADCN = {
  /** --background: hsl(0 0% 100%) */
  background: '#ffffff',
  /** --foreground: hsl(222.2 84% 4.9%) */
  foreground: '#020817',
  /** --card: hsl(0 0% 100%) */
  card: '#ffffff',
  /** --muted: hsl(210 40% 96.1%) */
  muted: '#f1f5f9',
  /** --muted-foreground: hsl(215.4 16.3% 46.9%) */
  mutedForeground: '#64748b',
  /** --border: hsl(214.3 31.8% 91.4%) */
  border: '#e2e8f0',
  /** --primary: hsl(222.2 47.4% 11.2%) */
  primary: '#0f172a',
  /** --primary-foreground: hsl(210 40% 98%) */
  primaryForeground: '#f8fafc',
  /** --secondary: hsl(210 40% 96.1%) */
  secondary: '#f1f5f9',
  /** --destructive: hsl(0 84.2% 60.2%) */
  destructive: '#ef4444',
  /** Not in shadcn core; the conventional success token added alongside it. */
  success: '#059669',
  /** Accent used for promotional mail, matching the shadcn violet preset. */
  violet: '#7c3aed',

  /** --radius: 0.5rem */
  radius: '8px',
  /** Slightly tighter radius shadcn uses for inner elements (calc(var(--radius) - 2px)). */
  radiusSm: '6px',

  /**
   * shadcn's font stack. Inter first, then the same system fallbacks
   * Tailwind ships, since a webfont cannot be relied on in email.
   */
  fontFamily:
    "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
} as const;
