import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

export type ParamChanges = Readonly<Record<string, string | undefined>>;

const PAGE_PARAM = 'page';

// Pure so the rule is easy to state: changing a filter goes back to page 1, since the old page
// number may not exist in the new results.
export function applyParamChanges(
  current: URLSearchParams,
  changes: ParamChanges,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (!(PAGE_PARAM in changes)) next.delete(PAGE_PARAM);
  for (const [name, value] of Object.entries(changes)) {
    if (value === undefined || value === '') next.delete(name);
    else next.set(name, value);
  }
  return next;
}

export function pageFrom(params: URLSearchParams): number {
  const page = Number(params.get(PAGE_PARAM));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

// Routing state (04-ARCH 5.3.1): filters live in the URL, so a list can be linked and reloaded.
export function useQueryParams() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (changes: ParamChanges) => {
      setParams((current) => applyParamChanges(current, changes), { replace: true });
    },
    [setParams],
  );
  const setPage = useCallback(
    (page: number) => {
      update({ [PAGE_PARAM]: String(page) });
    },
    [update],
  );
  return { params, update, page: pageFrom(params), setPage };
}
