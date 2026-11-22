/** Date and time wording for chat, in the viewer's locale and timezone. */

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
const shortWeekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const date = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());
const daysAgo = (value: Date) =>
  Math.round((startOfDay(new Date()).getTime() - startOfDay(value).getTime()) / 86_400_000);

/** "2:43 PM" — inside a bubble. */
export const messageTime = (iso: string) => time.format(new Date(iso));

/** "Today", "Yesterday", "Monday", "12 Nov 2026" — the separator between days. */
export function dayLabel(iso: string): string {
  const value = new Date(iso);
  const days = daysAgo(value);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekday.format(value);
  return date.format(value);
}

/** "2:43 PM", "Yesterday", "Mon", "12 Nov" — the conversation list. */
export function listTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const value = new Date(iso);
  const days = daysAgo(value);
  if (days === 0) return time.format(value);
  if (days === 1) return 'Yesterday';
  if (days < 7) return shortWeekday.format(value);
  return shortDate.format(value);
}

/** "Last seen 5 min ago", "Last seen today at 2:43 PM", "Last seen 12 Nov". */
export function lastSeenLabel(iso: string | null): string | null {
  if (!iso) return null;
  const value = new Date(iso);
  const minutes = Math.round((Date.now() - value.getTime()) / 60_000);
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes} min ago`;
  const days = daysAgo(value);
  if (days === 0) return `Last seen today at ${time.format(value)}`;
  if (days === 1) return `Last seen yesterday at ${time.format(value)}`;
  return `Last seen ${shortDate.format(value)}`;
}

export const sameDay = (a: string, b: string) =>
  startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
