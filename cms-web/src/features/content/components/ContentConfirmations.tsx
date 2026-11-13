import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import type { ContentType } from '../../../shared/api/types';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { contentMessages as m } from '../content.messages';

export type ConfirmKind = 'delete' | 'unpublish' | 'archive';

export interface ConfirmTarget {
  readonly kind: ConfirmKind;
  readonly type: ContentType;
  readonly title: string;
}

export interface ContentConfirmationsProps {
  readonly target: ConfirmTarget | null;
  onConfirm(): void;
  onCancel(): void;
}

const WORDING = {
  delete: { title: m.confirm.deleteTitle, body: m.confirm.deleteBody, confirm: m.actions.delete },
  unpublish: {
    title: m.confirm.unpublishTitle,
    body: m.confirm.unpublishBody,
    confirm: m.actions.unpublish,
  },
  archive: {
    title: m.confirm.archiveTitle,
    body: m.confirm.archiveBody,
    confirm: m.actions.archive,
  },
} as const;

// NFR-USE-02 and 03-DESIGN 13.5
export function ContentConfirmations({ target, onConfirm, onCancel }: ContentConfirmationsProps) {
  if (target === null) return null;
  const { kind, type, title } = target;
  const wording = WORDING[kind];
  return (
    <ConfirmDialog
      open
      destructive
      title={format(wording.title, { type: m.types[type].toLowerCase() })}
      body={format(wording.body, { title })}
      confirmLabel={wording.confirm}
      cancelLabel={common.cancel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
