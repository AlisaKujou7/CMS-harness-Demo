import type { MediaFilter } from '../../shared/media/media.api';
import type { MediaKind, MediaRow } from '../../shared/api/types';
import { pageFrom } from '../../shared/hooks/useQueryParams';

const KINDS: readonly MediaKind[] = ['image', 'document'];

function kindFrom(params: URLSearchParams): MediaKind | undefined {
  return KINDS.find((kind) => kind === params.get('kind'));
}

export function toMediaFilter(
  params: URLSearchParams,
  userId: string,
): MediaFilter & { to?: string } {
  const search = params.get('search');
  const from = params.get('from');
  const to = params.get('to');
  const kind = kindFrom(params);
  return {
    page: pageFrom(params),
    ...(search === null ? {} : { search }),
    ...(kind === undefined ? {} : { kind }),
    ...(params.get('mine') === '1' ? { uploaded_by: userId } : {}),
    ...(from === null ? {} : { from: new Date(`${from}T00:00:00`).toISOString() }),
    ...(to === null ? {} : { to: new Date(`${to}T23:59:59.999`).toISOString() }),
  };
}

export function hasMediaFilters(params: URLSearchParams): boolean {
  return ['search', 'kind', 'mine', 'from', 'to'].some((name) => params.has(name));
}

export interface MediaViewer {
  readonly id: string;
  readonly role: string;
}

// 02-SRS 5.3.1: Authors change and delete only what they uploaded.
export function canManage(viewer: MediaViewer, item: Pick<MediaRow, 'uploaded_by'>): boolean {
  return viewer.role !== 'author' || item.uploaded_by === viewer.id;
}

export function toggled(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  if (!next.delete(id)) next.add(id);
  return next;
}
