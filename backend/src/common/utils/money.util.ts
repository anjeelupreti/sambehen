/**
 * Decimal arithmetic on money values.
 *
 * Amounts are `numeric(18,2)` in postgres and strings in JSON, precisely so
 * JavaScript's binary floats never touch them: `0.1 + 0.2 !== 0.3`, and a
 * balance is not a place to discover that. These helpers work in integer
 * minor units (cents) internally and hand back strings.
 *
 * Aggregations belong in SQL, where postgres does exact decimal maths.
 * This is for the small comparisons and sums the service layer has to do,
 * such as capping a correction against its parent.
 */
const SCALE = 2;
const FACTOR = 100;

/** Parses a decimal string into integer minor units. Throws on nonsense. */
export function toMinorUnits(value: string | number): number {
  const text = typeof value === 'number' ? value.toFixed(SCALE) : value.trim();

  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new TypeError(`"${value}" is not a valid decimal amount`);
  }

  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  // Pad or truncate to exactly two decimal places rather than rounding,
  // so a stored value round-trips unchanged.
  const cents = `${fraction}00`.slice(0, SCALE);

  const minor = Number(whole) * FACTOR + Number(cents);
  return negative ? -minor : minor;
}

/** Formats integer minor units back to a fixed two-decimal string. */
export function fromMinorUnits(minor: number): string {
  const negative = minor < 0;
  const absolute = Math.abs(Math.trunc(minor));
  const whole = Math.floor(absolute / FACTOR);
  const cents = String(absolute % FACTOR).padStart(SCALE, '0');
  return `${negative ? '-' : ''}${whole}.${cents}`;
}

export const Money = {
  add: (a: string, b: string): string => fromMinorUnits(toMinorUnits(a) + toMinorUnits(b)),
  subtract: (a: string, b: string): string => fromMinorUnits(toMinorUnits(a) - toMinorUnits(b)),

  /** Negative, zero, or positive — mirroring Array.prototype.sort. */
  compare: (a: string, b: string): number => toMinorUnits(a) - toMinorUnits(b),
  isGreaterThan: (a: string, b: string): boolean => toMinorUnits(a) > toMinorUnits(b),
  isPositive: (a: string): boolean => toMinorUnits(a) > 0,
  isZero: (a: string): boolean => toMinorUnits(a) === 0,

  /** Normalises to exactly two decimal places. */
  normalise: (a: string): string => fromMinorUnits(toMinorUnits(a)),
};
