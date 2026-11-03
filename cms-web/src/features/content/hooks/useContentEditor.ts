import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { hasCode } from '../../../shared/api/api-error';
import type { ContentDetail, ContentType } from '../../../shared/api/types';
import { applyServerFieldError } from '../../../shared/forms/validation';
import { notify } from '../../../shared/stores/ui.store';
import { errorToMessage } from '../../../shared/streams/global-errors.stream';
import { contentMessages as m } from '../content.messages';
import { editorSchema, EMPTY_VALUES, toValues } from '../editor-values';
import type { EditorValues, RichTextDoc } from '../types/content.types';
import { useAutosave } from './useAutosave';
import { useContentSave } from './useContentSave';

const SERVER_FIELDS = {
  title: 'title',
  slug: 'slug',
  body: 'body',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description',
  tags: 'tags',
  category: 'category',
  parentId: 'parent_id',
} as const;

export interface ContentEditorArgs {
  readonly type: ContentType;
  readonly initial: ContentDetail | null;
  // The body with current image URLs, which is what the editor shows.
  readonly initialBody: RichTextDoc;
  readonly canEdit: (content: ContentDetail | null) => boolean;
  onCreated(content: ContentDetail): void;
}

export function useContentEditor({ initialBody, ...args }: ContentEditorArgs) {
  const { initial } = args;
  const form = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: initial === null ? EMPTY_VALUES : { ...toValues(initial), body: initialBody },
    mode: 'onTouched',
  });
  const [conflict, setConflict] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const { content, adopt, save, hasUnsaved, currentContent, pause } = useContentSave({
    ...args,
    form,
  });

  const onError = useCallback(
    (error: unknown) => {
      if (hasCode(error, 'CONTENT_CHANGED')) {
        pause();
        setConflict(true);
      } else if (!applyServerFieldError(error, SERVER_FIELDS, form.setError)) {
        notify.error(errorToMessage(error));
      }
    },
    [form, pause],
  );
  const { indicator, notifyChange, flush } = useAutosave({ save, onError });

  useEffect(
    () => form.subscribe({ formState: { values: true }, callback: notifyChange }),
    [form, notifyChange],
  );

  // Valid and saved, or says why not. An action like Publish acts on what the server has.
  const prepare = useCallback(async (): Promise<boolean> => {
    setBanner(null);
    if (!(await form.trigger(undefined, { shouldFocus: true }))) {
      setBanner(m.editor.fixFields);
      return false;
    }
    return (await flush()).kind !== 'error';
  }, [flush, form]);

  return {
    form,
    content,
    conflict,
    banner,
    indicator,
    adopt,
    saveNow: flush,
    hasUnsaved,
    prepare,
    currentContent,
  };
}
