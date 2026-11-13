import type { ContentListQuery, ContentType } from '../../shared/api/types';
import type { TableSort } from '../../design-system/components/DataTable';
import { pageFrom } from '../../shared/hooks/useQueryParams';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_SORT = '-updated_at';
const STATUSES = ['draft', 'in_review', 'published', 'unpublished', 'archived'] as const;
const PAGE_SIZES = new Set([10, 25, 50, 100]);

type Sort = NonNullable<ContentListQuery['sort']>;
type Status = NonNullable<ContentListQuery['status']>;

const SORT_COLUMNS: Readonly<Record<string, string>> = {
  title: 'title',
  updated: 'updated_at',
};
const VALID_SORTS = new Set<string>(
  Object.values(SORT_COLUMNS).flatMap((column) => [column, `-${column}`]),
);

function statusFrom(params: URLSearchParams): Status | undefined {
  return STATUSES.find((status) => status === params.get('status'));
}

export function sortFrom(params: URLSearchParams): Sort {
  const sort = params.get('sort');
  return (sort !== null && VALID_SORTS.has(sort) ? sort : DEFAULT_SORT) as Sort;
}

function pageSizeFrom(params: URLSearchParams): number | undefined {
  const size = Number(params.get('size'));
  return PAGE_SIZES.has(size) ? size : undefined;
}

function dateFilters(params: URLSearchParams, now: Date) {
  const from = params.get('from');
  const to = params.get('to');
  const recent = params.get('recent') === '1';
  const since = recent ? new Date(now.getTime() - THIRTY_DAYS_MS).toISOString() : undefined;
  const start = from === null ? since : new Date(`${from}T00:00:00`).toISOString();
  return {
    ...(start === undefined ? {} : { from: start }),
    ...(to === null ? {} : { to: new Date(`${to}T23:59:59.999`).toISOString() }),
  };
}

// The URL is the source of truth for the list (04-ARCH 5.3.1), and this is what it asks the API.
export function toContentQuery(
  params: URLSearchParams,
  type: ContentType,
  userId: string,
  now: Date,
): ContentListQuery {
  const status = statusFrom(params);
  const search = params.get('search');
  const tag = params.get('tag');
  const author = params.get('mine') === '1' ? userId : params.get('author');
  const size = pageSizeFrom(params);
  return {
    type,
    page: pageFrom(params),
    sort: sortFrom(params),
    ...(status === undefined ? {} : { status }),
    ...(search === null ? {} : { search }),
    ...(tag === null ? {} : { tag }),
    ...(author === null ? {} : { author_id: author }),
    ...(size === undefined ? {} : { page_size: size }),
    ...dateFilters(params, now),
  };
}

export function tableSort(sort: Sort): TableSort {
  const direction = sort.startsWith('-') ? 'desc' : 'asc';
  const column = sort.replace('-', '');
  const key = Object.keys(SORT_COLUMNS).find((name) => SORT_COLUMNS[name] === column);
  return { key: key ?? '', direction };
}

export function nextSort(current: Sort, key: string): string {
  const column = SORT_COLUMNS[key] ?? '';
  return current === column ? `-${column}` : column;
}

const FILTER_NAMES = ['status', 'search', 'mine', 'recent', 'author', 'tag', 'from', 'to'];

export function hasFilters(params: URLSearchParams): boolean {
  return FILTER_NAMES.some((name) => params.has(name));
}

export function clearedFilters(): Readonly<Record<string, undefined>> {
  return Object.fromEntries(FILTER_NAMES.map((name) => [name, undefined]));
}

export interface AuthorOption {
  readonly id: string;
  readonly name: string;
}

// Editors may not list users, so the choices are the authors in the results. Once one is chosen,
// the results are all theirs, so the choice stays in the list.
export function authorsIn(
  rows: readonly { readonly author_id: string; readonly author_name: string }[],
): readonly AuthorOption[] {
  const byId = new Map(rows.map((row) => [row.author_id, row.author_name]));
  return [...byId].map(([id, name]) => ({ id, name }));
}
