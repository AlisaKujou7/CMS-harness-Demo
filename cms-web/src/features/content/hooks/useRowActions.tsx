import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ApproveIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  PreviewIcon,
  PublishIcon,
  SendIcon,
  UnpublishIcon,
} from '../../../design-system/icons';
import type { ContentListRow } from '../../../shared/api/types';
import type { RowAction } from '../../../shared/components/RowMenu';
import type { ConfirmKind, ConfirmTarget } from '../components/ContentConfirmations';
import { contentMessages as m } from '../content.messages';
import { permissionsFor, type Viewer } from '../permissions';
import { editorPath } from '../types/content.types';
import { useContentActions, useDuplicate } from './useContentActions';

interface PendingConfirm extends ConfirmTarget {
  readonly id: string;
}

// 03-DESIGN 12.3: the row menu offers what the status and the role allow.
export function useRowActions(viewer: Viewer) {
  const navigate = useNavigate();
  const actions = useContentActions();
  const open = (row: ContentListRow) => {
    void navigate(editorPath(row.type, row.id));
  };
  const duplicate = useDuplicate((content) => {
    void navigate(editorPath(content.type, content.id));
  });
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const ask = (row: ContentListRow, kind: ConfirmKind) => () => {
    setPending({ kind, id: row.id, type: row.type, title: row.title });
  };

  const actionsFor = (row: ContentListRow): readonly RowAction[] => {
    const can = permissionsFor(viewer, row);
    const target = { id: row.id, type: row.type };
    return [
      {
        label: m.actions.view,
        icon: <PreviewIcon />,
        run: () => {
          open(row);
        },
      },
      ...(can.canEdit
        ? [
            {
              label: m.actions.edit,
              icon: <EditIcon />,
              run: () => {
                open(row);
              },
            },
          ]
        : []),
      {
        label: m.actions.duplicate,
        icon: <CopyIcon />,
        run: () => {
          duplicate.mutate(row.id);
        },
      },
      ...(can.canSubmit
        ? [
            {
              label: m.actions.submit,
              icon: <SendIcon />,
              run: () => {
                actions.submit.mutate(target);
              },
            },
          ]
        : []),
      ...(can.canPublish
        ? [
            {
              label: m.actions.publish,
              icon: <PublishIcon />,
              run: () => {
                actions.publish.mutate(target);
              },
            },
          ]
        : []),
      ...(can.canUnpublish
        ? [{ label: m.actions.unpublish, icon: <UnpublishIcon />, run: ask(row, 'unpublish') }]
        : []),
      ...(can.canArchive
        ? [{ label: m.actions.archive, icon: <ApproveIcon />, run: ask(row, 'archive') }]
        : []),
      ...(can.canDelete
        ? [{ label: m.actions.delete, icon: <DeleteIcon />, danger: true, run: ask(row, 'delete') }]
        : []),
    ];
  };

  const confirm = () => {
    if (pending === null) return;
    const target = { id: pending.id, type: pending.type };
    if (pending.kind === 'delete') actions.remove.mutate(target);
    if (pending.kind === 'unpublish') actions.unpublish.mutate(target);
    if (pending.kind === 'archive') actions.archive.mutate(target);
    setPending(null);
  };

  return {
    actionsFor,
    confirmations: {
      target: pending,
      onConfirm: confirm,
      onCancel: () => {
        setPending(null);
      },
    },
  };
}
