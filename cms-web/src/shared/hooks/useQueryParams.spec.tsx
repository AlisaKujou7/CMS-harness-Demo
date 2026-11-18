import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { applyParamChanges, pageFrom, useQueryParams } from './useQueryParams';

describe('applyParamChanges', () => {
  it('sets values, removes empty ones, and goes back to page 1', () => {
    const next = applyParamChanges(new URLSearchParams('page=3&a=1&b=2'), {
      a: undefined,
      b: '',
      c: '3',
    });

    expect(next.toString()).toBe('c=3');
  });

  it('keeps the rest when only the page changes', () => {
    const next = applyParamChanges(new URLSearchParams('a=1'), { page: '2' });

    expect(next.toString()).toBe('a=1&page=2');
  });
});

describe('pageFrom', () => {
  it.each([
    ['page=4', 4],
    ['', 1],
    ['page=0', 1],
    ['page=-2', 1],
    ['page=1.5', 1],
    ['page=x', 1],
  ])('reads %j as %i', (query, page) => {
    expect(pageFrom(new URLSearchParams(query))).toBe(page);
  });
});

describe('useQueryParams', () => {
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <MemoryRouter initialEntries={['/x?a=1']}>{children}</MemoryRouter>
  );

  it('reads and changes the URL', () => {
    const { result } = renderHook(() => useQueryParams(), { wrapper });
    expect(result.current.params.get('a')).toBe('1');

    act(() => {
      result.current.update({ a: '2' });
    });
    expect(result.current.params.get('a')).toBe('2');

    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);
  });
});
