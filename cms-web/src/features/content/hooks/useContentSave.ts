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
      if (form.getValues('slug') === '') form.setValue('slug', saved.slug);
    },
    [form, queryClient],
  );

  const save = useCallback(async (): Promise<boolean> => {
    const values = form.getValues();
    const existing = current.current;
    if (paused.current || !latest.current.canEdit(existing)) return false;
    if (!editorSchema.safeParse(values).success) return false;
    if (existing === null) {
      const created = await createContent(toCreateBody(type, values));
      adopt(created);
      latest.current.onCreated(created);
      return true;
    }
    const patch = toPatch(baseline.current, values);
    if (patch === null) return false;
    adopt(await updateContent(existing.id, { ...patch, version: existing.version }));
    return true;
  }, [adopt, form, type]);

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
