import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { aPage } from '../../../test/builders';
import { useClampPage } from './useClampPage';

const run = (result: Parameters<typeof useClampPage>[0]) => {
  const setPage = vi.fn();
  renderHook(() => {
    useClampPage(result, setPage);
  });
  return setPage;
};

describe('useClampPage', () => {
  it('goes to the last page when this one is past the end', () => {
    const setPage = run({ pagination: aPage({ page: 3, total: 50, total_pages: 2 }) });

    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('stays on the last page', () => {
    const setPage = run({ pagination: aPage({ page: 2, total: 50, total_pages: 2 }) });

    expect(setPage).not.toHaveBeenCalled();
  });

  it('stays when there is nothing anywhere', () => {
    const setPage = run({ pagination: aPage({ page: 3, total: 0, total_pages: 0 }) });

    expect(setPage).not.toHaveBeenCalled();
  });

  it('waits for an answer', () => {
    expect(run(undefined)).not.toHaveBeenCalled();
  });
});
