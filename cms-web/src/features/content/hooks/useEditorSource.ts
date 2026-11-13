import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ContentDetail } from '../../../shared/api/types';
import { getContent } from '../api/content.api';
import { EMPTY_DOC } from '../rich-text';
import type { RichTextDoc } from '../types/content.types';
import { useResolvedBody } from './useResolvedBody';

const NEW = 'new';
const SESSION_KEY = 'this-session';

interface EditorStart {
  readonly key: string;
  readonly initial: ContentDetail;
  readonly initialBody: RichTextDoc;
}

function startFor(start: EditorStart | null, key: string): EditorStart | null {
  return start?.key === key ? start : null;
}

// Loads once for each editor. From then on the form owns the content, so saves, refetches and their
// failures here must not replace it.
function useFirstLoad(id: string, key: string, needed: boolean) {
  const start = useRef<EditorStart | null>(null);
  const waiting = needed && startFor(start.current, key) === null;
  const query = useQuery({
    queryKey: ['content', 'detail', id],
    queryFn: () => getContent(id),
    enabled: waiting,
    staleTime: 0,
    gcTime: 0,
  });
  const body = waiting ? (query.data?.body as RichTextDoc | undefined) : undefined;
  const resolved = useResolvedBody(body);
  if (waiting && query.data && resolved !== null) {
    start.current = { key, initial: query.data, initialBody: resolved };
  }
  return { query, start: startFor(start.current, key) };
}

// Where the editor's starting point comes from. A new item stays "in session" when it gets its id,
// so the form is not remounted and what is typed during that first save survives.
export function useEditorSource(id: string) {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<ContentDetail | null>(null);
  const [generation, setGeneration] = useState(0);
  const inSession = id === NEW || created?.id === id;
  const key = `${String(generation)}:${inSession ? SESSION_KEY : id}`;
  const { query, start } = useFirstLoad(id, key, !inSession);
  const ready = inSession || start !== null;

  return {
    query,
    key,
    failed: !ready && query.isError,
    loading: !ready,
    initial: start?.initial ?? null,
    initialBody: start?.initialBody ?? EMPTY_DOC,
    adoptCreated: setCreated,
    // Throws away this editor and what it has, for a fresh copy from the server.
    reload: () => {
      setCreated(null);
      queryClient.removeQueries({ queryKey: ['content', 'detail', id] });
      setGeneration((value) => value + 1);
    },
  };
}
