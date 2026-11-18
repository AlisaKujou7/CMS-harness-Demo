import type { Blocker } from 'react-router';
import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import type { ContentType } from '../../../shared/api/types';
import { format } from '../../../shared/i18n/format';
import { contentMessages as m } from '../content.messages';
import type { EditorDialog } from '../hooks/useEditorActions';
import { ContentConfirmations } from './ContentConfirmations';
import { ConflictDialog, RejectDialog, ScheduleDialog } from './EditorDialogs';

export interface EditorOverlaysProps {
  readonly type: ContentType;
  readonly title: string;
  readonly dialog: EditorDialog;
  readonly conflict: boolean;
  readonly savingCopy: boolean;
  readonly blocker: Blocker;
  onConfirm(): void;
  onClose(): void;
  onSchedule(at: string): void;
  onReject(note: string): void;
  onReload(): void;
  onSaveCopy(): void;
}

function isConfirmation(dialog: EditorDialog): dialog is 'delete' | 'unpublish' | 'archive' {
  return dialog === 'delete' || dialog === 'unpublish' || dialog === 'archive';
}

// The dialogs an editor can raise, and the prompt for leaving with unsaved changes.
export function EditorOverlays(props: EditorOverlaysProps) {
  const { type, title, dialog, conflict, savingCopy, blocker } = props;
  const { onConfirm, onClose, onSchedule, onReject, onReload, onSaveCopy } = props;
  return (
    <>
      <ContentConfirmations
        target={isConfirmation(dialog) ? { kind: dialog, type, title } : null}
        onConfirm={onConfirm}
        onCancel={onClose}
      />
      {dialog === 'schedule' ? (
        <ScheduleDialog now={new Date()} onClose={onClose} onSubmit={onSchedule} />
      ) : null}
      {dialog === 'reject' ? <RejectDialog onClose={onClose} onSubmit={onReject} /> : null}
      {conflict ? (
        <ConflictDialog
          body={format(m.conflict.body, { type: m.types[type].toLowerCase() })}
          saving={savingCopy}
          onReload={onReload}
          onSaveCopy={onSaveCopy}
        />
      ) : null}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        destructive
        title={m.confirm.leaveTitle}
        body={m.confirm.leaveBody}
        confirmLabel={m.confirm.leave}
        cancelLabel={m.confirm.stay}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}
