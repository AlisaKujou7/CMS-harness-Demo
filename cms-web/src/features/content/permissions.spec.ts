import { describe, expect, it } from 'vitest';
import type { ContentStatus, UserRole } from '../../shared/api/types';
import { displayStatus, editorPath, listPath } from './types/content.types';
import { describeEditorPermission, permissionsFor, type PermissionSubject } from './permissions';

const ME = 'me';
const viewer = (role: UserRole) => ({ id: ME, role });
const subject = (overrides: Partial<PermissionSubject> = {}): PermissionSubject => ({
  status: 'draft',
  author_id: ME,
  scheduled_at: null,
  ...overrides,
});
const check = (role: UserRole, overrides: Partial<PermissionSubject> = {}) =>
  permissionsFor(viewer(role), subject(overrides));

describe('permissionsFor (02-SRS 5.3.1)', () => {
  it.each<[ContentStatus, boolean]>([
    ['draft', true],
    ['unpublished', true],
    ['in_review', false],
    ['published', false],
    ['archived', false],
  ])('lets an Author edit their own %s: %s', (status, allowed) => {
    expect(check('author', { status }).canEdit).toBe(allowed);
  });

  it("keeps an Author out of someone else's content", () => {
    const permissions = check('author', { author_id: 'other' });

    expect(permissions).toMatchObject({ canEdit: false, canSubmit: false, canSeeHistory: false });
  });

  it('stops an Author editing what is scheduled, since an Editor approved that text', () => {
    expect(check('author', { scheduled_at: 'soon' }).canEdit).toBe(false);
  });

  it('lets an Author submit their own draft and nothing beyond it', () => {
    expect(check('author')).toEqual({
      canEdit: true,
      canSubmit: true,
      canPublish: false,
      canSchedule: false,
      canReject: false,
      canUnpublish: false,
      canArchive: false,
      canDelete: false,
      canSeeHistory: true,
    });
  });

  it.each<[UserRole]>([['editor'], ['admin']])("lets an %s work on anyone's content", (role) => {
    const others = { author_id: 'other' };

    expect(check(role, others)).toMatchObject({
      canEdit: true,
      canSubmit: true,
      canPublish: true,
      canSchedule: true,
      canDelete: true,
      canSeeHistory: true,
    });
  });

  it.each<[ContentStatus, Partial<Record<string, boolean>>]>([
    ['in_review', { canPublish: true, canSchedule: true, canReject: true, canSubmit: false }],
    ['published', { canPublish: false, canSchedule: false, canUnpublish: true, canEdit: true }],
    ['unpublished', { canPublish: false, canArchive: true, canUnpublish: false, canSubmit: false }],
    ['archived', { canEdit: false, canPublish: false, canArchive: false }],
  ])('follows the lifecycle for %s', (status, expected) => {
    expect(check('editor', { status })).toMatchObject(expected);
  });
});

describe('describeEditorPermission', () => {
  it('lets anyone start a new item', () => {
    expect(describeEditorPermission(viewer('author'), null)).toBe(true);
  });

  it('follows the rules for a saved one', () => {
    expect(describeEditorPermission(viewer('author'), subject({ author_id: 'other' }))).toBe(false);
  });
});

describe('content paths', () => {
  it('keep articles and pages apart', () => {
    expect(listPath('article')).toBe('/content/articles');
    expect(listPath('page')).toBe('/content/pages');
    expect(editorPath('page', 'x')).toBe('/content/pages/x');
  });
});

describe('displayStatus (ADR-0013)', () => {
  it('derives Scheduled from scheduled_at', () => {
    expect(displayStatus('draft', 'soon')).toBe('scheduled');
    expect(displayStatus('in_review', 'soon')).toBe('scheduled');
    expect(displayStatus('draft', null)).toBe('draft');
  });

  it('keeps Published even with a stale schedule', () => {
    expect(displayStatus('published', 'soon')).toBe('published');
  });
});
