import { describe, expect, it } from 'vitest';
import { isLongSummary, previewOf, summaryText, toAuditFilter } from './audit-filters';

describe('toAuditFilter', () => {
  it('passes along what is chosen and nothing else', () => {
    expect(toAuditFilter(new URLSearchParams('action=content.publish&page=2'))).toEqual({
      action: 'content.publish',
    });
    expect(toAuditFilter(new URLSearchParams('actor_id=a&target_type=media'))).toEqual({
      actor_id: 'a',
      target_type: 'media',
    });
  });

  it('turns local days into a range of whole days', () => {
    const { from, to } = toAuditFilter(new URLSearchParams('from=2026-05-01&to=2026-05-02'));

    expect(from).toBe(new Date(2026, 4, 1).toISOString());
    expect(to).toBe(new Date(2026, 4, 2, 23, 59, 59, 999).toISOString());
  });
});

describe('summaryText', () => {
  it.each([
    [{}, ''],
    [null, ''],
    [undefined, ''],
    [{ a: 1 }, '{"a":1}'],
    ['text', '"text"'],
  ])('writes %j as %j', (summary, text) => {
    expect(summaryText(summary)).toBe(text);
  });
});

describe('previewOf', () => {
  it('shortens only what is long', () => {
    const exact = 'x'.repeat(60);
    expect(isLongSummary(exact)).toBe(false);
    expect(previewOf(exact)).toBe(exact);

    const long = 'x'.repeat(61);
    expect(isLongSummary(long)).toBe(true);
    expect(previewOf(long)).toBe(`${exact}…`);
  });
});
