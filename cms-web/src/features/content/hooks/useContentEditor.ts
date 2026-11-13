import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
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

function useSaveErrors(form: UseFormReturn<EditorValues>, pause: () => void) {
  const [conflict, setConflict] = useState(false);
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
  return { conflict, onError };
}

export function useContentEditor({ initialBody, ...args }: ContentEditorArgs) {
  const { initial } = args;
  const form = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: initial === null ? EMPTY_VALUES : { ...toValues(initial), body: initialBody },
    mode: 'onTouched',
  });
  const [banner, setBanner] = useState<string | null>(null);
  const saving = useContentSave({ ...args, form });
  const { save, currentContent, pause } = saving;
  const { conflict, onError } = useSaveErrors(form, pause);
  // Saving published content changes what the public reads, so only the person editing may decide
  // that it is ready (ADR-0013). The check at the save covers a timer set before it was published.
  const isLive = useCallback(() => currentContent()?.status === 'published', [currentContent]);
  const asked = useRef(false);
  const saveIfAllowed = useCallback(
    () => (isLive() && !asked.current ? Promise.resolve(false) : save()),
    [isLive, save],
  );
  const { indicator, notifyChange, flush } = useAutosave({ save: saveIfAllowed, onError });

  useEffect(() => {
    const callback = () => {
      if (!isLive()) notifyChange();
    };
    return form.subscribe({ formState: { values: true }, callback });
  }, [form, isLive, notifyChange]);

  const saveOnBlur = useCallback(() => {
    if (!isLive()) void flush();
  }, [flush, isLive]);

  // Valid and saved, or says why not. An action like Publish acts on what the server has.
  const prepare = useCallback(async (): Promise<boolean> => {
    setBanner(null);
    if (!(await form.trigger(undefined, { shouldFocus: true }))) {
      setBanner(m.editor.fixFields);
      return false;
    }
    asked.current = true;
    const outcome = await flush();
    asked.current = false;
    return outcome.kind !== 'error';
  }, [flush, form]);

  return { ...saving, form, conflict, banner, indicator, saveOnBlur, isLive, prepare };
}
