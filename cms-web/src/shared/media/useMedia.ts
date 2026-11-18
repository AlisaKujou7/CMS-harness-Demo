import { useQuery } from '@tanstack/react-query';
import type { MediaRow, Paged } from '../api/types';
import { listMedia, type MediaFilter } from './media.api';

const PROCESSING_POLL_MS = 2000;

// 03-DESIGN 20.1: a new tile shows a placeholder until its variants are ready.
export function pollWhileProcessing(page: Paged<MediaRow> | undefined): number | false {
  return page?.data.some((item) => item.variant_status === 'pending') === true
    ? PROCESSING_POLL_MS
    : false;
}

export function useMediaList(filter: MediaFilter) {
  return useQuery({
    queryKey: ['media', 'list', filter],
    queryFn: () => listMedia(filter),
    refetchInterval: (query) => pollWhileProcessing(query.state.data),
  });
}
