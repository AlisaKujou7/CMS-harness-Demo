import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ContentDetail } from '../../../shared/api/types';
import { getContent } from '../api/content.api';
import { EMPTY_DOC } from '../rich-text';
import type { RichTextDoc } from '../types/content.types';
import { useResolvedBody } from './useResolvedBody';

const NEW = 'new';
const SESSION_KEY = 'this-session';
const IN_SESSION = { failed: false, loading: false, initial: null, initialBody: EMPTY_DOC };

function loadState(
  query: { readonly isError: boolean; readonly data?: ContentDetail | undefined },
  resolved: RichTextDoc | null,
) {
  return {
    failed: query.isError,
    loading: resolved === null,
    initial: query.data ?? null,
    initialBody: resolved ?? EMPTY_DOC,
  };
}

// Where the editor's starting point comes from. A new item stays "in session" when it gets its id,
// so the form is not remounted and what is typed during that first save survives.
export function useEditorSource(id: string) {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<ContentDetail | null>(null);
  const [generation, setGeneration] = useState(0);
  const inSession = id === NEW || created?.id === id;
  const queryKey = ['content', 'detail', id];
  const query = useQuery({
    queryKey,
    queryFn: () => getContent(id),
    enabled: !inSession,
    staleTime: 0,
    gcTime: 0,
  });
  const resolved = useResolvedBody(query.data?.body as RichTextDoc | undefined);

  return {
    ...(inSession ? IN_SESSION : loadState(query, resolved)),
    query,
    key: `${String(generation)}:${inSession ? SESSION_KEY : id}`,
    adoptCreated: setCreated,
    // Throws away this editor and what it has, for a fresh copy from the server.
    reload: () => {
      setCreated(null);
      queryClient.removeQueries({ queryKey });
      setGeneration((value) => value + 1);
    },
  };
}
