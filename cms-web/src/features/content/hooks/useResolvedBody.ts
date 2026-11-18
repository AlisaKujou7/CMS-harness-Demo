import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getMedia } from '../../../shared/media/media.api';
import { collectMediaIds, withCurrentUrls } from '../rich-text';
import type { RichTextDoc } from '../types/content.types';

// Stored image URLs expire, so the editor asks for current ones by mediaId (ADR-0013). Null until
// every answer is in, because the editor reads its document once when it mounts.
export function useResolvedBody(body: RichTextDoc | undefined): RichTextDoc | null {
  const ids = useMemo(() => (body ? collectMediaIds(body) : []), [body]);
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['media', 'detail', id],
      queryFn: () => getMedia(id),
      retry: false,
    })),
  });
  const settled = results.every((result) => !result.isPending);
  const urls = results.map((result) => result.data?.url ?? null).join('\n');

  return useMemo(() => {
    if (!body || !settled) return null;
    const list = urls.split('\n');
    const map = new Map(ids.map((id, index) => [id, list[index] || null]));
    return withCurrentUrls(body, map);
  }, [body, settled, urls, ids]);
}
