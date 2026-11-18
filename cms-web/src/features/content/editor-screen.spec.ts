import { describe, expect, it } from 'vitest';
import { aContent, ID } from '../../../test/builders';
import { ApiError } from '../../shared/api/api-error';
import { describeEditor, missingFieldsMessage } from './editor-screen';

const editor = { id: 'me', role: 'editor' } as const;
const author = { id: 'me', role: 'author' } as const;

describe('describeEditor', () => {
  it("treats a new item as the viewer's own draft", () => {
    expect(describeEditor(author, 'page', null)).toMatchObject({
      can: { canEdit: true },
      status: 'draft',
      crumb: 'New Page',
      historyPath: null,
      scheduledLabel: null,
    });
  });

  it('describes a saved item', () => {
    const screen = describeEditor(editor, 'article', aContent({ title: 'T', status: 'in_review' }));

    expect(screen).toMatchObject({
      status: 'in_review',
      crumb: 'Editing "T"',
      historyPath: `/content/articles/${ID.content}/versions`,
      scheduledLabel: null,
    });
  });

  it('hides history from someone who may not see it', () => {
    expect(describeEditor(author, 'article', aContent()).historyPath).toBeNull();
  });

  it('says when it is scheduled', () => {
    const screen = describeEditor(
      editor,
      'article',
      aContent({ scheduled_at: '2030-01-01T00:00:00Z' }),
    );

    expect(screen.status).toBe('scheduled');
    expect(screen.scheduledLabel).toContain('20');
  });
});

describe('missingFieldsMessage', () => {
  const anError = (code: string, details = {}) =>
    new ApiError({ status: 422, code, message: 'm', details });

  it('names the fields', () => {
    expect(missingFieldsMessage(anError('MISSING_REQUIRED_FIELDS', { fields: ['a', 'b'] }))).toBe(
      'Publishing needs: a, b.',
    );
  });

  it('answers null for anything else', () => {
    expect(missingFieldsMessage(anError('OTHER'))).toBeNull();
    expect(missingFieldsMessage(null)).toBeNull();
  });
});
