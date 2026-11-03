import type { UserRow } from '../api/types';
import { auditActionLabels, auditMessages } from './audit.messages';

export function actionLabel(action: string): string {
  return auditActionLabels[action] ?? action;
}

// Audit events keep only the actor's id, and a deleted user's id matches nothing.
export function actorName(actorId: string | null, users: readonly UserRow[]): string {
  if (actorId === null) return auditMessages.system;
  return users.find((user) => user.id === actorId)?.name ?? auditMessages.someone;
}
