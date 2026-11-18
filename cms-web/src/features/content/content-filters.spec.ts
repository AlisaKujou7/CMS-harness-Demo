import { describe, expect, it } from 'vitest';
import { aListRow } from '../../../test/builders';
import {
  authorsIn,
  clearedFilters,
  hasFilters,
  nextSort,
  sortFrom,
  tableSort,
  toContentQuery,
} from './content-filters';

const NOW = new Date('2026-05-31T00:00:00Z');
const query = (search: string) => toContentQuery(new URLSearchParams(search), 'article', 'me', NOW);

describe('toContentQuery', () => {
  it('asks for the type, newest first, by default', () => {
    expect(query('')).toEqual({ type: 'article', page: 1, sort: '-updated_at' });
  });

  it('passes filters along', () => {
    expect(query('status=draft&search=q2&tag=news&author=a1&page=3&size=50')).toEqual({
      type: 'article',
      page: 3,
      sort: '-updated_at',
      status: 'draft',
      search: 'q2',
      tag: 'news',
      author_id: 'a1',
      page_size: 50,
    });
  });

  it('ignores a status or page size that does not exist', () => {
    const result = query('status=nope&size=7');

    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('page_size');
  });

  it('filters to my own content', () => {
    expect(query('mine=1').author_id).toBe('me');
    expect(query('mine=1&author=a1').author_id).toBe('me');
    expect(query('mine=0')).not.toHaveProperty('author_id');
  });

  it('turns Last 30 days into a date', () => {
    expect(query('recent=1').from).toBe('2026-05-01T00:00:00.000Z');
    expect(query('recent=0')).not.toHaveProperty('from');
  });

  it('prefers a chosen date, and covers whole local days', () => {
    const result = query('recent=1&from=2026-01-02&to=2026-01-03');

    expect(result.from).toBe(new Date(2026, 0, 2).toISOString());
    expect(result.to).toBe(new Date(2026, 0, 3, 23, 59, 59, 999).toISOString());
  });
});

describe('sorting', () => {
  it('reads a valid sort and falls back otherwise', () => {
    expect(sortFrom(new URLSearchParams('sort=title'))).toBe('title');
    expect(sortFrom(new URLSearchParams('sort=-updated_at'))).toBe('-updated_at');
    expect(sortFrom(new URLSearchParams('sort=evil'))).toBe('-updated_at');
    expect(sortFrom(new URLSearchParams(''))).toBe('-updated_at');
  });

  it('describes the sort for the table', () => {
    expect(tableSort('-updated_at')).toEqual({ key: 'updated', direction: 'desc' });
    expect(tableSort('title')).toEqual({ key: 'title', direction: 'asc' });
    expect(tableSort('created_at')).toEqual({ key: '', direction: 'asc' });
  });

  it('flips a column, and starts another ascending', () => {
    expect(nextSort('title', 'title')).toBe('-title');
    expect(nextSort('-title', 'title')).toBe('title');
    expect(nextSort('-updated_at', 'title')).toBe('title');
    expect(nextSort('title', 'unknown')).toBe('');
  });
});

describe('filter helpers', () => {
  it('knows whether anything is filtered', () => {
    expect(hasFilters(new URLSearchParams('page=2&sort=title'))).toBe(false);
    expect(hasFilters(new URLSearchParams('tag=a'))).toBe(true);
  });

  it('clears every filter', () => {
    expect(clearedFilters()).toEqual(
      expect.objectContaining({ search: undefined, status: undefined, tag: undefined }),
    );
    expect(Object.keys(clearedFilters())).toContain('search');
  });

  it('lists each author in the results once', () => {
    const rows = [
      aListRow({ author_id: 'a', author_name: 'Ann' }),
      aListRow({ author_id: 'b', author_name: 'Bob' }),
      aListRow({ author_id: 'a', author_name: 'Ann' }),
    ];

    expect(authorsIn(rows)).toEqual([
      { id: 'a', name: 'Ann' },
      { id: 'b', name: 'Bob' },
    ]);
  });
});
