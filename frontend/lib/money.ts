/**
 * Money handling.
 *
 * The API serialises `numeric(18,2)` as strings and never as JSON numbers,
 * because a float cannot hold every 2dp decimal exactly and the error
 * compounds once you start adding. That guarantee is worth nothing if the
 * frontend calls `Number()` on the way in, so nothing here does.
 *
 * Formatting parses only at the very last step, for display of a single
 * value. Arithmetic across rows belongs in SQL — the API already returns a
 * `summary` computed over the whole filtered set, so a client-side sum is
 * both wrong (it only sees the current page) and unnecessary.
 */

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? 'USD';
const DEFAULT_LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? 'en-US';

/** Formats a money string for display. Returns an em dash for null. */
export function formatMoney(
  value: string | null | undefined,
  options: { currency?: string; locale?: string; showCurrency?: boolean } = {},
): string {
  if (value === null || value === undefined || value === '') return '—';

  const { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, showCurrency = true } = options;

  // Parsed here and nowhere else: this value goes straight to the screen
  // and is never fed back into a calculation.
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;

  return new Intl.NumberFormat(locale, {
    style: showCurrency ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

/** Compact form for tiles: 1.2M rather than 1,200,000.00. */
export function formatMoneyCompact(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';

  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;

  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(parsed);
}

/** True when the amount is below zero, without parsing for arithmetic. */
export function isNegative(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trimStart().startsWith('-');
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(DEFAULT_LOCALE).format(value);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: 'medium' }).format(date);
}
