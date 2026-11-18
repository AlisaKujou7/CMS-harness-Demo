import type { ContentStatus, UserRole } from '../../shared/api/types';

export interface PermissionSubject {
  readonly status: ContentStatus;
  readonly author_id: string;
  readonly scheduled_at: string | null;
}

export interface Viewer {
  readonly id: string;
  readonly role: UserRole;
}

export interface ContentPermissions {
  readonly canEdit: boolean;
  readonly canSubmit: boolean;
  readonly canPublish: boolean;
  readonly canSchedule: boolean;
  readonly canReject: boolean;
  readonly canUnpublish: boolean;
  readonly canArchive: boolean;
  readonly canDelete: boolean;
  readonly canSeeHistory: boolean;
}

const AUTHOR_EDITABLE: readonly ContentStatus[] = ['draft', 'unpublished'];

function moderatorPermissions(status: ContentStatus): ContentPermissions {
  const publishable = status === 'draft' || status === 'in_review';
  return {
    canEdit: status !== 'archived',
    canSubmit: status === 'draft',
    canPublish: publishable,
    canSchedule: publishable,
    canReject: status === 'in_review',
    canUnpublish: status === 'published',
    canArchive: status === 'unpublished',
    canDelete: true,
    canSeeHistory: true,
  };
}

function authorPermissions(viewer: Viewer, subject: PermissionSubject): ContentPermissions {
  const mine = subject.author_id === viewer.id;
  const { status, scheduled_at: scheduledAt } = subject;
  return {
    canEdit: mine && AUTHOR_EDITABLE.includes(status) && scheduledAt === null,
    canSubmit: mine && status === 'draft',
    canPublish: false,
    canSchedule: false,
    canReject: false,
    canUnpublish: false,
    canArchive: false,
    canDelete: false,
    canSeeHistory: mine,
  };
}

// A new item has no record yet, and is the viewer's own draft until it is saved.
export function describeEditorPermission(
  viewer: Viewer,
  subject: PermissionSubject | null,
): boolean {
  const item = subject ?? { status: 'draft', author_id: viewer.id, scheduled_at: null };
  return permissionsFor(viewer, item).canEdit;
}

// 02-SRS 5.3.1 and 5.4.1, so the screen offers only what the API would allow. The API still decides.
export function permissionsFor(viewer: Viewer, subject: PermissionSubject): ContentPermissions {
  return viewer.role === 'author'
    ? authorPermissions(viewer, subject)
    : moderatorPermissions(subject.status);
}
