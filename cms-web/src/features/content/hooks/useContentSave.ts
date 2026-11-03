import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { ContentDetail, ContentType } from '../../../shared/api/types';
import { createContent, updateContent } from '../api/content.api';
import { editorSchema, EMPTY_VALUES, toCreateBody, toPatch, toValues } from '../editor-values';
import type { EditorValues } from '../types/content.types';

export interface ContentSaveArgs {
  readonly form: UseFormReturn<EditorValues>;
  readonly type: ContentType;
  readonly initial: ContentDetail | null;
  readonly canEdit: (content: ContentDetail | null) => boolean;
  onCreated(content: ContentDetail): void;
}

const NORMALIZED_FIELDS = ['title', 'slug', 'seo_title', 'seo_description'] as const;

// The server trims text, strips tags and makes the first slug. A field still holding what was sent
// takes the server's version, or it would look unsaved forever. One edited since is left alone.
function takeServerText(
  form: UseFormReturn<EditorValues>,
  sent: EditorValues,
  saved: EditorValues,
): void {
  for (const name of NORMALIZED_FIELDS) {
    if (saved[name] !== sent[name] && form.getValues(name) === sent[name]) {
      form.setValue(name, saved[name]);
    }
  }
}

// Knows what the server last confirmed, and sends only the difference with that version.
export function useContentSave(args: ContentSaveArgs) {
  const { form, type, initial } = args;
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initial);
  const current = useRef(initial);
  const baseline = useRef(initial === null ? EMPTY_VALUES : toValues(initial));
  const paused = useRef(false);
  const latest = useRef(args);
  latest.current = args;

  const adopt = useCallback(
    (saved: ContentDetail) => {
      current.current = saved;
      baseline.current = toValues(saved);
      setContent(saved);
      queryClient.setQueryData(['content', 'detail', saved.id], saved);
    },
    [queryClient],
  );

  const send = useCallback(
    (values: EditorValues, existing: ContentDetail | null) => {
      if (existing === null) return createContent(toCreateBody(type, values));
      const patch = toPatch(baseline.current, values);
      if (patch === null) return null;
      return updateContent(existing.id, { ...patch, version: existing.version });
    },
    [type],
  );

  const save = useCallback(async (): Promise<boolean> => {
    const values = form.getValues();
    const existing = current.current;
    if (paused.current || !latest.current.canEdit(existing)) return false;
    if (!editorSchema.safeParse(values).success) return false;
    const request = send(values, existing);
    if (request === null) return false;
    const saved = await request;
    adopt(saved);
    takeServerText(form, values, toValues(saved));
    if (existing === null) latest.current.onCreated(saved);
    return true;
  }, [adopt, form, send]);

  const hasUnsaved = useCallback(
    () => toPatch(baseline.current, form.getValues()) !== null,
    [form],
  );
  const currentContent = useCallback(() => current.current, []);
  const pause = useCallback(() => {
    paused.current = true;
  }, []);

  return { content, adopt, save, hasUnsaved, currentContent, pause };
}
