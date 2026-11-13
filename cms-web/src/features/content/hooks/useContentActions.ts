import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContentDetail, ContentType } from '../../../shared/api/types';
import { format } from '../../../shared/i18n/format';
import { notify } from '../../../shared/stores/ui.store';
import {
  archiveContent,
  createContent,
  deleteContent,
  getContent,
  publishContent,
  rejectContent,
  restoreContent,
  scheduleContent,
  submitContent,
  undoUnpublish,
  unpublishContent,
} from '../api/content.api';
import { contentMessages as m } from '../content.messages';
import { toDuplicate } from '../editor-values';

export interface ActionTarget {
  readonly id: string;
  readonly type: ContentType;
}

const say = (template: string, type: ContentType) => format(template, { type: m.types[type] });

function useRefresh(onChanged?: (content: ContentDetail) => void) {
  const queryClient = useQueryClient();
  return (content?: ContentDetail) => {
    if (content) {
      queryClient.setQueryData(['content', 'detail', content.id], content);
      onChanged?.(content);
    }
    return queryClient.invalidateQueries({ queryKey: ['content'] });
  };
}

type Run = (target: ActionTarget) => Promise<ContentDetail>;

function useSimple(run: Run, message: string, onChanged?: (content: ContentDetail) => void) {
  const refresh = useRefresh(onChanged);
  return useMutation({
    mutationFn: run,
    onSuccess: (content, { type }) => {
      notify.success(say(message, type));
      return refresh(content);
    },
  });
}

// 03-DESIGN 15.1, including the Undo that unpublishing and deleting offer.
export function useContentActions(onChanged?: (content: ContentDetail) => void) {
  const refresh = useRefresh(onChanged);
  const republish = useSimple(({ id }) => undoUnpublish(id), m.toasts.republished, onChanged);
  const restore = useSimple(({ id }) => restoreContent(id), m.toasts.restored, onChanged);
  const unpublish = useMutation({
    mutationFn: ({ id }: ActionTarget) => unpublishContent(id),
    onSuccess: (content, target) => {
      notify.info(say(m.toasts.unpublished, target.type), {
        label: m.actions.undo,
        run: () => {
          republish.mutate(target);
        },
      });
      return refresh(content);
    },
  });
  const remove = useMutation({
    mutationFn: ({ id }: ActionTarget) => deleteContent(id),
    onSuccess: (_result, target) => {
      notify.info(say(m.toasts.deleted, target.type), {
        label: m.actions.undo,
        run: () => {
          restore.mutate(target);
        },
      });
      return refresh();
    },
  });
  return {
    submit: useSimple(({ id }) => submitContent(id), m.toasts.submitted, onChanged),
    publish: useSimple(({ id }) => publishContent(id), m.toasts.published, onChanged),
    archive: useSimple(({ id }) => archiveContent(id), m.toasts.archived, onChanged),
    unpublish,
    remove,
  };
}

export function useReject(onChanged?: (content: ContentDetail) => void) {
  const refresh = useRefresh(onChanged);
  return useMutation({
    mutationFn: ({ target, note }: { target: ActionTarget; note: string }) =>
      rejectContent(target.id, note),
    onSuccess: (content, { target }) => {
      notify.success(say(m.toasts.rejected, target.type));
      return refresh(content);
    },
  });
}

export function useSchedule(onChanged?: (content: ContentDetail) => void) {
  const refresh = useRefresh(onChanged);
  return useMutation({
    mutationFn: ({ target, at }: { target: ActionTarget; at: string | null }) =>
      scheduleContent(target.id, at),
    onSuccess: (content, { target, at }) => {
      notify.success(
        at === null ? m.toasts.scheduleCancelled : say(m.toasts.scheduled, target.type),
      );
      return refresh(content);
    },
  });
}

export function useDuplicate(onCreated: (content: ContentDetail) => void) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const original = await getContent(id);
      return createContent(toDuplicate(original, format(m.copyOf, { title: original.title })));
    },
    onSuccess: (content) => {
      notify.success(say(m.toasts.duplicated, content.type));
      onCreated(content);
      return refresh(content);
    },
  });
}
