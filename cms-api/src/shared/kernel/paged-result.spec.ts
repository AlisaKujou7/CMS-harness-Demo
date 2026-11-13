import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  InvalidPageRequestError,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  pagedResult,
  toPageRequest,
} from './paged-result.js';

describe('toPageRequest', () => {
  it('defaults to the first page of 25 items', () => {
    expect(toPageRequest({})).toEqual({ page: 1, pageSize: 25 });
  });

  it('keeps a valid page and page size', () => {
    expect(toPageRequest({ page: 3, pageSize: 50 })).toEqual({ page: 3, pageSize: 50 });
  });

  it('accepts the maximum page size of 100', () => {
    expect(toPageRequest({ pageSize: 100 }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('caps a page size above the maximum', () => {
    expect(toPageRequest({ pageSize: 101 }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('accepts the smallest page and page size', () => {
    expect(toPageRequest({ page: 1, pageSize: 1 })).toEqual({ page: 1, pageSize: 1 });
  });

  it.each([
    ['zero page', { page: 0 }],
    ['negative page', { page: -1 }],
    ['fractional page', { page: 1.5 }],
    ['zero page size', { pageSize: 0 }],
    ['negative page size', { pageSize: -5 }],
    ['fractional page size', { pageSize: 2.5 }],
  ])('rejects a %s', (_name, input) => {
    expect(() => toPageRequest(input)).toThrow(InvalidPageRequestError);
  });

  it('names the invalid field and value in the error', () => {
    expect(() => toPageRequest({ page: 0 })).toThrow('page must be a positive integer, got 0');
    expect(() => toPageRequest({ pageSize: -5 })).toThrow(
      'pageSize must be a positive integer, got -5',
    );
  });

  it('identifies the error by name for the HTTP error mapper', () => {
    const error = new InvalidPageRequestError('page', 0);

    expect(error.name).toBe('InvalidPageRequestError');
  });

  it('accepts the last allowed page and rejects anything beyond it', () => {
    expect(toPageRequest({ page: MAX_PAGE }).page).toBe(MAX_PAGE);
    expect(() => toPageRequest({ page: MAX_PAGE + 1 })).toThrow(InvalidPageRequestError);
    expect(() => toPageRequest({ page: 1e30 })).toThrow(InvalidPageRequestError);
  });

  it('exposes the default page size from FR-PUBAPI-05', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });
});

describe('pagedResult', () => {
  it('rounds total pages up when the last page is partial', () => {
    const result = pagedResult(['a'], 137, { page: 1, pageSize: 25 });

    expect(result).toEqual({ items: ['a'], page: 1, pageSize: 25, total: 137, totalPages: 6 });
  });

  it('does not add an extra page when the total divides evenly', () => {
    expect(pagedResult([], 50, { page: 1, pageSize: 25 }).totalPages).toBe(2);
  });

  it('reports zero pages for an empty result', () => {
    expect(pagedResult([], 0, { page: 1, pageSize: 25 }).totalPages).toBe(0);
  });

  it('always has enough pages to hold the total', () => {
    fc.assert(
      fc.property(fc.nat(100_000), fc.integer({ min: 1, max: 100 }), (total, pageSize) => {
        const { totalPages } = pagedResult([], total, { page: 1, pageSize });

        expect(totalPages * pageSize).toBeGreaterThanOrEqual(total);
        expect(Math.max(totalPages - 1, 0) * pageSize).toBeLessThan(Math.max(total, 1));
      }),
    );
  });
});
