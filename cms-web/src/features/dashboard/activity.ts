import type { AuditRow, ContentListRow, UserRow } from '../../shared/api/types';
import { actionLabel, actorName } from '../../shared/audit/audit-labels';
import { format } from '../../shared/i18n/format';
import { dashboardMessages as m } from './dashboard.messages';

export interface ActivityItem {
  readonly id: string;
  readonly text: string;
  readonly at: string;
}

export function fromAudit(events: readonly AuditRow[], users: readonly UserRow[]): ActivityItem[] {
  return events.map((event) => ({
    id: event.id,
    text: format(m.activityLine, {
      actor: actorName(event.actor_id, users),
      action: actionLabel(event.action),
    }),
    at: event.occurred_at,
  }));
}

export function fromContent(rows: readonly ContentListRow[]): ActivityItem[] {
  return rows.map((row) => ({
    id: row.id,
    text: format(m.contentLine, { author: row.author_name, title: row.title }),
    at: row.updated_at,
  }));
}
