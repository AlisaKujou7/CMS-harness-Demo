import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithTheme } from '../../../../test/utils/render-with-providers';
import { AutosaveIndicator, type IndicatorState } from './AutosaveIndicator';
import { DocPreview } from './DocPreview';
import { StatusChip } from './StatusChip';
import { addTag } from './TagsField';

describe('StatusChip (03-DESIGN 17.3)', () => {
  it.each([
    ['draft', 'Draft'],
    ['in_review', 'In Review'],
    ['scheduled', 'Scheduled'],
    ['published', 'Published'],
    ['unpublished', 'Unpublished'],
    ['archived', 'Archived'],
  ] as const)('labels %s for sight and for screen readers', (status, label) => {
    renderWithTheme(<StatusChip status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(`Status: ${label}`)).toBeInTheDocument();
  });
});

describe('AutosaveIndicator (03-DESIGN 19.4)', () => {
  const NOW = new Date('2026-05-15T12:00:05Z');

  it.each<[IndicatorState, string]>([
    [{ kind: 'idle' }, ''],
    [{ kind: 'saving' }, 'Saving...'],
    [{ kind: 'saved', at: new Date('2026-05-15T12:00:00Z') }, 'Saved 5 seconds ago'],
    [{ kind: 'retrying' }, "Couldn't save. Retrying..."],
    [{ kind: 'error' }, "Couldn't save."],
  ])('shows %j', (state, text) => {
    renderWithTheme(<AutosaveIndicator state={state} now={NOW} />);

    expect(screen.getByRole('status')).toHaveTextContent(text);
  });
});

describe('addTag', () => {
  it('lowercases, trims, and ignores what adds nothing', () => {
    expect(addTag(['a'], ' News ')).toEqual(['a', 'news']);
    expect(addTag(['a'], 'A')).toEqual(['a']);
    expect(addTag(['a'], '   ')).toEqual(['a']);
  });
});

describe('DocPreview', () => {
  const text = (value: string, marks?: unknown[]) => ({
    type: 'text',
    text: value,
    ...(marks ? { marks } : {}),
  });

  it('renders the node types the server allows', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [text('Title')] },
        { type: 'heading', content: [text('Default level')] },
        {
          type: 'paragraph',
          content: [
            text('b', [{ type: 'bold' }]),
            text('i', [{ type: 'italic' }]),
            text('u', [{ type: 'underline' }]),
            text('s', [{ type: 'strike' }]),
            text('c', [{ type: 'code' }]),
            text('Linked', [{ type: 'link', attrs: { href: '/x' } }]),
            text('plain', [{ type: 'unknown' }, {}]),
            { type: 'hardBreak' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [text('Item')] }] },
          ],
        },
        { type: 'orderedList', content: [] },
        { type: 'blockquote', content: [] },
        { type: 'codeBlock', content: [text('<b>safe</b>')] },
        { type: 'horizontalRule' },
        { type: 'image', attrs: { src: 'https://x/y', alt: 'Pic' } },
        { type: 'image', attrs: { src: 'https://x/z' } },
        { type: 'wrapper', content: [text('Kept')] },
        {},
      ],
    };
    const { container } = renderWithTheme(<DocPreview doc={doc} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Default level' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Linked' })).toHaveAttribute('href', '/x');
    expect(screen.getByRole('listitem')).toHaveTextContent('Item');
    expect(screen.getByRole('img', { name: 'Pic' })).toBeInTheDocument();
    expect(screen.getByText('Kept')).toBeInTheDocument();
    expect(screen.getByText('<b>safe</b>').tagName).toBe('PRE');
    for (const tag of ['strong', 'em', 'u', 's', 'code', 'br', 'hr', 'ol', 'blockquote']) {
      expect(container.querySelector(tag)).not.toBeNull();
    }
  });
});
