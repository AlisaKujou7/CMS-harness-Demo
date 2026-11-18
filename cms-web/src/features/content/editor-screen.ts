import type { ContentDetail, ContentType } from '../../shared/api/types';
import { type ApiError, hasCode } from '../../shared/api/api-error';
import { format } from '../../shared/i18n/format';
import { formatDateTime } from '../../shared/utils/time';
import { contentMessages as m } from './content.messages';
import { type ContentPermissions, permissionsFor, type Viewer } from './permissions';
import { type DisplayStatus, displayStatus, editorPath } from './types/content.types';

export interface EditorScreen {
  readonly can: ContentPermissions;
  readonly status: DisplayStatus;
  readonly crumb: string;
  readonly historyPath: string | null;
  readonly scheduledLabel: string | null;
}

// What the screen shows for this content, this viewer and a new item that has no record yet.
export function describeEditor(
  viewer: Viewer,
  type: ContentType,
  content: ContentDetail | null,
): EditorScreen {
  if (content === null) {
    const draft = { status: 'draft', author_id: viewer.id, scheduled_at: null } as const;
    return {
      can: permissionsFor(viewer, draft),
      status: 'draft',
      crumb: format(m.newItem, { type: m.types[type] }),
      historyPath: null,
      scheduledLabel: null,
    };
  }
  const can = permissionsFor(viewer, content);
  return {
    can,
    status: displayStatus(content.status, content.scheduled_at),
    crumb: format(m.editing, { title: content.title }),
    historyPath: can.canSeeHistory ? `${editorPath(type, content.id)}/versions` : null,
    scheduledLabel: content.scheduled_at ? formatDateTime(content.scheduled_at) : null,
  };
}

export function missingFieldsMessage(error: unknown): string | null {
  if (!hasCode(error, 'MISSING_REQUIRED_FIELDS')) return null;
  const { fields } = (error as ApiError).details;
  return format(m.editor.missingFields, { fields: (fields as string[]).join(', ') });
}
