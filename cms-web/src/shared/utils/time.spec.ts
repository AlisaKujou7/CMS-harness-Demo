import { describe, expect, it } from 'vitest';
import { formatDateTime, formatRelative, fromLocalInput, greetingKey, toLocalInput } from './time';

const NOW = new Date('2026-05-15T12:00:00Z');
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);

describe('formatRelative', () => {
  it.each([
    [0, '0 seconds ago'],
    [5, '5 seconds ago'],
    [59, '59 seconds ago'],
    [60, '1 minute ago'],
    [120, '2 minutes ago'],
    [3599, '59 minutes ago'],
    [3600, '1 hour ago'],
    [86_399, '23 hours ago'],
    [86_400, '1 day ago'],
    [2_592_000, '1 month ago'],
    [31_536_000, '1 year ago'],
  ])('describes %i seconds ago', (seconds, text) => {
    expect(formatRelative(ago(seconds), NOW)).toBe(text);
  });

  it('describes the future too', () => {
    expect(formatRelative(ago(-120), NOW)).toBe('in 2 minutes');
  });

  it('accepts a timestamp from the API', () => {
    expect(formatRelative('2026-05-15T11:59:00Z', NOW)).toBe('1 minute ago');
  });
});

describe('formatDateTime', () => {
  it('names the date and the time', () => {
    const text = formatDateTime('2026-05-15T12:00:00Z');

    expect(text).toContain('2026');
    expect(text).toMatch(/\d:\d\d/);
  });
});

describe('local datetime input', () => {
  it('writes the local time in the input format and reads it back', () => {
    const value = new Date(2026, 0, 5, 9, 7);

    expect(toLocalInput(value)).toBe('2026-01-05T09:07');
    expect(fromLocalInput('2026-01-05T09:07')).toBe(value.toISOString());
  });
});

describe('greetingKey', () => {
  it.each([
    [0, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [23, 'evening'],
  ])('at %i is %s', (hour, key) => {
    expect(greetingKey(hour)).toBe(key);
  });
});
