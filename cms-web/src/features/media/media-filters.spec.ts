import { describe, expect, it } from 'vitest';
import { canManage, hasMediaFilters, toggled, toMediaFilter } from './media-filters';

describe('toMediaFilter (FR-MEDIA-08)', () => {
  const filter = (query: string) => toMediaFilter(new URLSearchParams(query), 'me');

  it('asks for page 1 by default', () => {
    expect(filter('')).toEqual({ page: 1 });
  });

  it('passes along what is chosen', () => {
    expect(filter('search=cat&kind=image&mine=1&page=2')).toEqual({
      page: 2,
      search: 'cat',
      kind: 'image',
      uploaded_by: 'me',
    });
  });

  it('ignores a kind that does not exist, and mine unless it is on', () => {
    expect(filter('kind=video&mine=0')).toEqual({ page: 1 });
  });

  it('covers whole local days', () => {
    const { from, to } = toMediaFilter(new URLSearchParams('from=2026-01-02&to=2026-01-03'), 'me');

    expect(from).toBe(new Date(2026, 0, 2).toISOString());
    expect(to).toBe(new Date(2026, 0, 3, 23, 59, 59, 999).toISOString());
  });
});

describe('hasMediaFilters', () => {
  it('ignores the page', () => {
    expect(hasMediaFilters(new URLSearchParams('page=2'))).toBe(false);
    expect(hasMediaFilters(new URLSearchParams('kind=image'))).toBe(true);
  });
});

describe('canManage (02-SRS 5.3.1)', () => {
  it('lets an Author manage only their own uploads', () => {
    const author = { id: 'me', role: 'author' };

    expect(canManage(author, { uploaded_by: 'me' })).toBe(true);
    expect(canManage(author, { uploaded_by: 'other' })).toBe(false);
  });

  it('lets anyone else manage any upload', () => {
    expect(canManage({ id: 'me', role: 'editor' }, { uploaded_by: 'other' })).toBe(true);
  });
});

describe('toggled', () => {
  it('adds and removes without changing the original', () => {
    const none = new Set<string>();
    const one = toggled(none, 'a');

    expect([...one]).toEqual(['a']);
    expect([...toggled(one, 'a')]).toEqual([]);
    expect(none.size).toBe(0);
  });
});
