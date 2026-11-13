const MINUTE_S = 60;
const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['second', 1],
  ['minute', MINUTE_S],
  ['hour', 3600],
  ['day', 86_400],
  ['month', 2_592_000],
  ['year', 31_536_000],
];

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

// NFR-I18N-02: values arrive in UTC and are shown in the user's own timezone.
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  const size = Math.abs(seconds);
  const [unit, length] =
    UNITS.findLast(([, unitLength]) => size >= unitLength) ?? (['second', 1] as const);
  const count = Math.trunc(size / length);
  // Negative zero is how Intl says "0 seconds ago", where zero would be "in 0 seconds".
  return relative.format(seconds > 0 ? count : -count, unit);
}

const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(value: string | Date): string {
  return dateTime.format(new Date(value));
}

const pad = (value: number) => String(value).padStart(2, '0');

// What <input type="datetime-local"> expects, in the user's own timezone.
export function toLocalInput(value: Date): string {
  const date = `${String(value.getFullYear())}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return `${date}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

export function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  return hour < 18 ? 'afternoon' : 'evening';
}
