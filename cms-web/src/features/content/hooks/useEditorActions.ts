import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { ContentDetail, ContentType } from '../../../shared/api/types';
import { format } from '../../../shared/i18n/format';
import { notify } from '../../../shared/stores/ui.store';
import { createContent } from '../api/content.api';
import type { ConfirmKind } from '../components/ContentConfirmations';
import { contentMessages as m } from '../content.messages';
import { toCreateBody } from '../editor-values';
import type { EditorValues } from '../types/content.types';
import { type ActionTarget, useContentActions, useReject, useSchedule } from './useContentActions';
import type { useContentEditor } from './useContentEditor';

export type EditorDialog = 'schedule' | 'reject' | ConfirmKind | null;

interface EditorActionsArgs {
  readonly editor: ReturnType<typeof useContentEditor>;
  readonly type: ContentType;
  onCopied(content: ContentDetail): void;
  onDeleted(): void;
}

function useSaveCopy(type: ContentType, onCopied: (content: ContentDetail) => void) {
  return useMutation({
    mutationFn: (values: EditorValues) =>
      createContent(
        toCreateBody(type, {
          ...values,
          slug: '',
          title: format(m.copyOf, { title: values.title }),
        }),
      ),
    onSuccess: onCopied,
  });
}

// What the panel's buttons do. Each saves first, since the server acts on what it has.
export function useEditorActions({ editor, type, onCopied, onDeleted }: EditorActionsArgs) {
  const { adopt, prepare, currentContent, content } = editor;
  const [dialog, setDialog] = useState<EditorDialog>(null);
  const actions = useContentActions(adopt);
  const target = content === null ? null : { id: content.id, type };
  const whenSaved = (run: (saved: ActionTarget) => void) => () => {
    void (async () => {
      const saved = (await prepare()) ? currentContent() : null;
      if (saved !== null) run({ id: saved.id, type });
    })();
  };
  const show = (next: EditorDialog) => () => {
    setDialog(next);
  };
  const close = show(null);
  const confirm = () => {
    close();
    if (target === null) return;
    if (dialog === 'delete') actions.remove.mutate(target, { onSuccess: onDeleted });
    if (dialog === 'unpublish') actions.unpublish.mutate(target);
    if (dialog === 'archive') actions.archive.mutate(target);
  };

  return {
    dialog,
    close,
    confirm,
    target,
    saveCopy: useSaveCopy(type, onCopied),
    reject: useReject(adopt),
    schedule: useSchedule(adopt),
    publishError: actions.publish.error,
    busy: actions.publish.isPending || actions.submit.isPending,
    handlers: {
      onSave: whenSaved(() => notify.success(m.toasts.saved)),
      onSubmit: whenSaved((saved) => {
        actions.submit.mutate(saved);
      }),
      onPublish: whenSaved((saved) => {
        actions.publish.mutate(saved);
      }),
      onSchedule: show('schedule'),
      onReject: show('reject'),
      onUnpublish: show('unpublish'),
      onArchive: show('archive'),
      onDelete: show('delete'),
    },
  };
}
