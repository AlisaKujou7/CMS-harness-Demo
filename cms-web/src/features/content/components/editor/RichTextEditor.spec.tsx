import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { aMedia, aPage, ID } from '../../../../../test/builders';
import { server } from '../../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../../test/utils/a11y';
import { renderPage } from '../../../../../test/utils/render-with-providers';
import type { RichTextDoc } from '../../types/content.types';
import { LazyRichTextEditor } from './LazyRichTextEditor';
import { RichTextEditor, type RichTextEditorProps } from './RichTextEditor';

const paragraph = (text: string): RichTextDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function setup(props: Partial<RichTextEditorProps> = {}) {
  const onChange = vi.fn<(doc: RichTextDoc) => void>();
  const onBlur = vi.fn();
  const view = renderPage(
    <RichTextEditor
      initial={paragraph('Hello')}
      editable
      onChange={onChange}
      onBlur={onBlur}
      {...props}
    />,
  );
  return { ...view, onChange, onBlur };
}

const body = () => screen.getByRole('textbox', { name: 'Body' });
const tool = (name: string) => screen.getByRole('button', { name });
const lastDoc = (onChange: ReturnType<typeof vi.fn>) =>
  JSON.stringify(onChange.mock.lastCall?.[0] ?? {});

describe('RichTextEditor (03-DESIGN 19)', () => {
  it('shows the document, with the toolbar from the design', async () => {
    setup();

    expect(body()).toHaveTextContent('Hello');
    for (const name of [
      'Undo',
      'Redo',
      'Paragraph',
      'Heading 2',
      'Heading 3',
      'Heading 4',
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Code',
      'Bulleted list',
      'Numbered list',
      'Link',
      'Image',
      'Horizontal rule',
      'Blockquote',
      'Code block',
      'Fullscreen',
    ]) {
      expect(tool(name)).toBeInTheDocument();
    }
    await expectNoA11yViolations();
  });

  it.each([
    ['Heading 2', '"level":2'],
    ['Heading 3', '"level":3'],
    ['Heading 4', '"level":4'],
    ['Bulleted list', 'bulletList'],
    ['Numbered list', 'orderedList'],
    ['Blockquote', 'blockquote'],
    ['Code block', 'codeBlock'],
    ['Horizontal rule', 'horizontalRule'],
  ])('%s changes the document', async (name, expected) => {
    const { user, onChange } = setup();

    await user.click(tool(name));

    expect(lastDoc(onChange)).toContain(expected);
  });

  it.each(['Bold', 'Italic', 'Underline', 'Strikethrough', 'Code'])(
    '%s shows as pressed at the cursor',
    async (name) => {
      const { user } = setup();

      await user.click(tool(name));

      await waitFor(() => {
        expect(tool(name)).toHaveAttribute('aria-pressed', 'true');
      });
    },
  );

  it('goes back to a paragraph, and undoes and redoes', async () => {
    const { user, onChange } = setup();
    expect(tool('Undo')).toBeDisabled();

    await user.click(tool('Heading 2'));
    expect(lastDoc(onChange)).toContain('heading');
    await user.click(tool('Paragraph'));
    expect(lastDoc(onChange)).not.toContain('heading');

    await user.click(tool('Undo'));
    await user.click(tool('Redo'));
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('reports a blur', () => {
    const { onBlur } = setup();

    fireEvent.focus(body());
    fireEvent.blur(body());

    expect(onBlur).toHaveBeenCalled();
  });

  it('toggles fullscreen', async () => {
    const { user } = setup();

    await user.click(tool('Fullscreen'));
    expect(tool('Fullscreen')).toHaveAttribute('aria-pressed', 'true');

    await user.click(tool('Fullscreen'));
    expect(tool('Fullscreen')).toHaveAttribute('aria-pressed', 'false');
  });

  it('is read-only when it should be', () => {
    setup({ editable: false });

    expect(body()).toHaveAttribute('contenteditable', 'false');
    expect(tool('Bold')).toBeDisabled();
    expect(tool('Fullscreen')).toBeEnabled();
  });

  describe('links', () => {
    const openWithKeyboard = () => {
      fireEvent.keyDown(body(), { key: 'k', ctrlKey: true });
    };

    it('opens on Ctrl-K, inserts text with a link, and refuses unsafe URLs', async () => {
      const { user, onChange } = setup();

      openWithKeyboard();
      const dialog = within(await screen.findByRole('dialog', { name: 'Insert link' }));
      await user.type(dialog.getByLabelText('URL'), 'javascript:alert(1)');
      await user.tab();
      expect(dialog.getByText(/Use http, https/)).toBeInTheDocument();
      expect(dialog.getByRole('button', { name: 'Apply' })).toBeDisabled();

      await user.clear(dialog.getByLabelText('URL'));
      await user.type(dialog.getByLabelText('URL'), 'https://a.example');
      await user.type(dialog.getByLabelText('Display text (optional)'), 'Here');
      await user.click(dialog.getByLabelText('Open in a new tab'));
      await user.click(dialog.getByRole('button', { name: 'Apply' }));

      const doc = lastDoc(onChange);
      expect(doc).toContain('https://a.example');
      expect(doc).toContain('Here');
      expect(doc).toContain('_blank');
    });

    it('leaves other keys alone', () => {
      setup();

      fireEvent.keyDown(body(), { key: 'k' });
      fireEvent.keyDown(body(), { key: 'j', metaKey: true });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens on Cmd-K too, and can be cancelled', async () => {
      const { user } = setup();

      fireEvent.keyDown(body(), { key: 'k', metaKey: true });
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('edits and removes an existing link', async () => {
      const linked: RichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Hi',
                marks: [{ type: 'link', attrs: { href: '/old', target: '_blank' } }],
              },
            ],
          },
        ],
      };
      const { user, onChange } = setup({ initial: linked });

      await user.click(tool('Link'));
      const dialog = within(await screen.findByRole('dialog'));
      expect(dialog.getByLabelText('URL')).toHaveValue('/old');
      expect(dialog.getByLabelText('Open in a new tab')).toBeChecked();

      await user.clear(dialog.getByLabelText('URL'));
      await user.type(dialog.getByLabelText('URL'), '/new');
      await user.click(dialog.getByRole('button', { name: 'Apply' }));
      expect(lastDoc(onChange)).toContain('/new');

      await user.click(tool('Link'));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove link' }),
      );
      expect(lastDoc(onChange)).not.toContain('/new');
    });
  });

  describe('images', () => {
    const answerMedia = () => {
      server.use(
        http.get('*/api/admin/media', () =>
          HttpResponse.json({ data: [aMedia()], pagination: aPage() }),
        ),
      );
    };

    it('inserts from the library with its mediaId and alt text', async () => {
      answerMedia();
      const { user, onChange } = setup();

      await user.click(tool('Image'));
      await user.click(await screen.findByRole('button', { name: /hero.jpg/ }));
      await user.click(screen.getByRole('button', { name: 'Insert' }));

      await waitFor(() => {
        const doc = lastDoc(onChange);
        expect(doc).toContain(ID.media);
        expect(doc).toContain('A hero');
      });
    });

    it('inserts an image with no alt text as empty', async () => {
      server.use(
        http.get('*/api/admin/media', () =>
          HttpResponse.json({ data: [aMedia({ alt_text: null })], pagination: aPage() }),
        ),
      );
      const { user, onChange } = setup();

      await user.click(tool('Image'));
      await user.click(await screen.findByRole('button', { name: /hero.jpg/ }));
      await user.click(screen.getByRole('button', { name: 'Insert' }));

      await waitFor(() => {
        expect(lastDoc(onChange)).toContain('"alt":""');
      });
    });

    it('can be cancelled', async () => {
      answerMedia();
      const { user } = setup();

      await user.click(tool('Image'));
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('edits the alt text of the selected image', async () => {
      answerMedia();
      const { user, onChange } = setup();

      await user.click(tool('Image'));
      await user.click(await screen.findByRole('button', { name: /hero.jpg/ }));
      await user.click(screen.getByRole('button', { name: 'Insert' }));
      fireEvent.change(await screen.findByLabelText('Image alt text'), {
        target: { value: 'Described' },
      });

      expect(lastDoc(onChange)).toContain('Described');
    });

    it('keeps mediaId when reading the document back', () => {
      const withImage: RichTextDoc = {
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'https://x/y', alt: 'A', mediaId: ID.media } }],
      };
      setup({ initial: withImage });

      expect(screen.getByRole('img', { name: 'A' })).toHaveAttribute('data-media-id', ID.media);
    });

    it('renders an external image without a media id', () => {
      const external: RichTextDoc = {
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'https://x/y', alt: 'B' } }],
      };
      setup({ initial: external });

      expect(screen.getByRole('img', { name: 'B' })).not.toHaveAttribute('data-media-id');
    });
  });
});

describe('LazyRichTextEditor', () => {
  it('loads the editor when it is needed', async () => {
    renderPage(
      <LazyRichTextEditor
        initial={paragraph('Later')}
        editable
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    expect(await screen.findByRole('textbox', { name: 'Body' })).toHaveTextContent('Later');
  });
});
