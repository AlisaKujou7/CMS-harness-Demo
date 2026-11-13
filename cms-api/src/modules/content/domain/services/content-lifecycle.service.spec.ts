import { describe, expect, it } from 'vitest';
import { InvalidTransitionError } from '../errors/content.errors.js';
import {
  assertTransition,
  CONTENT_STATUSES,
  type ContentStatus,
} from './content-lifecycle.service.js';

const ALLOWED: readonly (readonly [ContentStatus, ContentStatus])[] = [
  ['draft', 'in_review'],
  ['draft', 'published'],
  ['in_review', 'published'],
  ['in_review', 'draft'],
  ['published', 'unpublished'],
  ['unpublished', 'draft'],
  ['unpublished', 'archived'],
];

const isAllowed = (from: ContentStatus, to: ContentStatus) =>
  ALLOWED.some(([a, b]) => a === from && b === to);

const everyPair = CONTENT_STATUSES.flatMap((from) =>
  CONTENT_STATUSES.map((to) => [from, to] as const),
);

describe('assertTransition (02-SRS 5.4.1)', () => {
  it.each(everyPair.filter(([from, to]) => isAllowed(from, to)))('allows %s to %s', (from, to) => {
    expect(() => {
      assertTransition(from, to);
    }).not.toThrow();
  });

  it.each(everyPair.filter(([from, to]) => !isAllowed(from, to)))(
    'refuses %s to %s (FR-CONTENT-04)',
    (from, to) => {
      expect(() => {
        assertTransition(from, to);
      }).toThrow(InvalidTransitionError);
    },
  );

  it('covers all five statuses', () => {
    expect(CONTENT_STATUSES).toEqual([
      'draft',
      'in_review',
      'published',
      'unpublished',
      'archived',
    ]);
  });

  it('reports a conflict that names both states', () => {
    const error = new InvalidTransitionError('archived', 'published');

    expect(error.kind).toBe('conflict');
    expect(error.code).toBe('INVALID_TRANSITION');
    expect(error.details).toEqual({ from: 'archived', to: 'published' });
    expect(error.message).toBe('Content cannot move from archived to published');
  });
});
