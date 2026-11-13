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
type Editor = ReturnType<typeof useContentEditor>;

interface EditorActionsArgs {
  readonly editor: Editor;
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

// Saves first, because the server acts on what it has and a save racing the action would look like
// someone else's edit. Live content is the exception, since saving would publish unfinished edits.
function useWhenSaved({ prepare, currentContent, isLive }: Editor, type: ContentType) {
  return (run: (saved: ActionTarget) => void) => {
    void (async () => {
      const ready = isLive() || (await prepare());
      const item = currentContent();
      if (ready && item !== null) run({ id: item.id, type });
    })();
  };
}

function saveWithToast({ prepare, isLive }: Editor) {
  return () => {
    void (async () => {
      const toast = isLive() ? m.toasts.changesSaved : m.toasts.saved;
      if (await prepare()) notify.success(toast);
    })();
  };
}

function dialogOpeners(show: (next: EditorDialog) => () => void) {
  return {
    onSchedule: show('schedule'),
    onReject: show('reject'),
    onUnpublish: show('unpublish'),
    onArchive: show('archive'),
    onDelete: show('delete'),
  };
}

// What the panel's buttons do.
export function useEditorActions({ editor, type, onCopied, onDeleted }: EditorActionsArgs) {
  const { adopt, content } = editor;
  const [dialog, setDialog] = useState<EditorDialog>(null);
  const actions = useContentActions(adopt);
  const reject = useReject(adopt);
  const schedule = useSchedule(adopt);
  const whenSaved = useWhenSaved(editor, type);
  const show = (next: EditorDialog) => () => {
    setDialog(next);
  };
  const close = show(null);
  const confirm = () => {
    close();
    // Deleting needs nothing saved first, and invalid fields must not stand in its way.
    if (dialog === 'delete' && content) {
      actions.remove.mutate({ id: content.id, type }, { onSuccess: onDeleted });
    }
    if (dialog === 'unpublish') whenSaved(actions.unpublish.mutate);
    if (dialog === 'archive') whenSaved(actions.archive.mutate);
  };

  return {
    dialog,
    close,
    confirm,
    saveCopy: useSaveCopy(type, onCopied),
    scheduleAt: (at: string | null) => {
      close();
      whenSaved((target) => {
        schedule.mutate({ target, at });
      });
    },
    rejectWith: (note: string) => {
      close();
      whenSaved((target) => {
        reject.mutate({ target, note });
      });
    },
    publishError: actions.publish.error,
    busy: actions.publish.isPending || actions.submit.isPending,
    handlers: {
      onSave: saveWithToast(editor),
      onSubmit: () => {
        whenSaved(actions.submit.mutate);
      },
      onPublish: () => {
        whenSaved(actions.publish.mutate);
      },
      ...dialogOpeners(show),
    },
  };
}
