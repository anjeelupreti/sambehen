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

/**
 * A money string as a plot coordinate.
 *
 * Charts are the one place a number is unavoidable: a scale has to turn an
 * amount into a pixel offset. The rule this bends is narrower than it looks
 * — the danger is a parsed float being *summed* or *shown*, and neither
 * happens here. Totals still come from the API's SQL aggregates, and every
 * figure a chart displays (axis ticks, tooltips, labels) is formatted from
 * the original string, never from this value.
 *
 * Returns 0 for null or unparseable input so a single bad row cannot break
 * the whole series.
 */
export function toPlotValue(value: string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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
