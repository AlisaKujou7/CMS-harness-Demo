import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  ArticleIcon,
  DeleteIcon,
  PublishIcon,
  RejectIcon,
  SaveIcon,
  ScheduleIcon,
  SendIcon,
  UnpublishIcon,
} from '../../../design-system/icons';
import { contentMessages as m } from '../content.messages';
import type { ContentPermissions } from '../permissions';
import type { DisplayStatus } from '../types/content.types';
import { PanelCard } from './PanelCard';
import { StatusChip } from './StatusChip';

export interface PublishHandlers {
  onSave(): void;
  onSubmit(): void;
  onPublish(): void;
  onSchedule(): void;
  onReject(): void;
  onUnpublish(): void;
  onArchive(): void;
  onDelete(): void;
}

export interface PublishPanelProps extends PublishHandlers {
  readonly status: DisplayStatus;
  readonly can: ContentPermissions;
  readonly isNew: boolean;
  readonly busy: boolean;
  readonly historyPath: string | null;
}

interface ActionProps {
  readonly show: boolean;
  readonly busy: boolean;
  readonly label: string;
  readonly icon: ReactNode;
  readonly variant?: 'outlined' | 'text';
  onClick(): void;
}

function Action({ show, busy, label, icon, variant = 'outlined', onClick }: ActionProps) {
  if (!show) return null;
  return (
    <Button variant={variant} startIcon={icon} disabled={busy} onClick={onClick}>
      {label}
    </Button>
  );
}

// 03-DESIGN 12.4. Publish stays visible to an Author, disabled, as the design draws it.
export function PublishPanel(props: PublishPanelProps) {
  const { status, can, isNew, busy, historyPath } = props;
  return (
    <PanelCard title={m.editor.publishPanel}>
      <Typography variant="bodyMedium" component="div">
        {m.editor.statusLabel} <StatusChip status={status} />
      </Typography>
      <Action
        show={can.canEdit}
        busy={busy}
        label={m.actions.saveDraft}
        icon={<SaveIcon />}
        onClick={props.onSave}
      />
      <Action
        show={can.canSubmit && !isNew}
        busy={busy}
        label={m.actions.submit}
        icon={<SendIcon />}
        onClick={props.onSubmit}
      />
      <Button
        variant="contained"
        startIcon={<PublishIcon />}
        disabled={busy || !can.canPublish}
        onClick={props.onPublish}
      >
        {m.actions.publish}
      </Button>
      <Action
        show={can.canSchedule && !isNew}
        busy={busy}
        label={m.actions.schedule}
        icon={<ScheduleIcon />}
        onClick={props.onSchedule}
      />
      <Action
        show={can.canReject}
        busy={busy}
        label={m.actions.reject}
        icon={<RejectIcon />}
        onClick={props.onReject}
      />
      <Action
        show={can.canUnpublish}
        busy={busy}
        label={m.actions.unpublish}
        icon={<UnpublishIcon />}
        onClick={props.onUnpublish}
      />
      <Action
        show={can.canArchive}
        busy={busy}
        label={m.actions.archive}
        icon={<ArticleIcon />}
        onClick={props.onArchive}
      />
      <Action
        show={can.canDelete && !isNew}
        busy={busy}
        label={m.actions.delete}
        icon={<DeleteIcon />}
        variant="text"
        onClick={props.onDelete}
      />
      {historyPath === null ? null : (
        <Link component={RouterLink} to={historyPath} variant="labelLarge">
          {m.actions.history}
        </Link>
      )}
    </PanelCard>
  );
}
