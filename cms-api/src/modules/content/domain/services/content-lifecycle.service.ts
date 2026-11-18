import { InvalidTransitionError } from '../errors/content.errors.js';

export const CONTENT_STATUSES = [
  'draft',
  'in_review',
  'published',
  'unpublished',
  'archived',
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

// 02-SRS 5.4.1. Draft to published is the direct path the 11.2 acceptance test gives Editors.
const TRANSITIONS: Readonly<Record<ContentStatus, readonly ContentStatus[]>> = {
  draft: ['in_review', 'published'],
  in_review: ['published', 'draft'],
  published: ['unpublished'],
  unpublished: ['draft', 'archived'],
  archived: [],
};

export function assertTransition(from: ContentStatus, to: ContentStatus): void {
  if (!TRANSITIONS[from].includes(to)) throw new InvalidTransitionError(from, to);
}
