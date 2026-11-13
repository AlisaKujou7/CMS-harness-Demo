import { useEffect } from 'react';
import type { Pagination } from '../api/types';

// A page can stop existing, when its last row is deleted or an old link is opened. Rows still exist
// elsewhere then, so this goes to the last page rather than saying there are none.
export function useClampPage(
  result: { readonly pagination: Pagination } | undefined,
  setPage: (page: number) => void,
) {
  const { page = 1, total = 0, total_pages: lastPage = 1 } = result?.pagination ?? {};
  const beyondTheEnd = total > 0 && page > lastPage;
  useEffect(() => {
    if (beyondTheEnd) setPage(lastPage);
  }, [beyondTheEnd, lastPage, setPage]);
}
