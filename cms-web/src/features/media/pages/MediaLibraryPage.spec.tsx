import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aMedia, aMediaDetail, aPage, ID } from '../../../../test/builders';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import {
  anAdmin,
  anAuthor,
  anEditor,
  renderPage,
  signIn,
} from '../../../../test/utils/render-with-providers';
import type { MediaDetail, MediaRow } from '../../../shared/api/types';
import { MediaLibraryPage } from './MediaLibraryPage';

const LIST = '*/api/admin/media';
const ONE = `${LIST}/${ID.media}`;

function answer(rows: readonly MediaRow[] = [aMedia()]) {
  const urls: URL[] = [];
  server.use(
    http.get(LIST, ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({ data: rows, pagination: aPage({ total_pages: 2 }) });
    }),
  );
  return urls;
}

function answerDetail(detail: Partial<MediaDetail> = {}) {
  server.use(http.get(ONE, () => HttpResponse.json({ data: aMediaDetail(detail) })));
}

function setup(route = '/media', user = anEditor) {
  signIn(user);
  return renderPage(<MediaLibraryPage />, { route });
}

const openDetails = async (user: ReturnType<typeof setup>['user']) => {
  await user.click(await screen.findByRole('button', { name: /hero.jpg/ }));
  return screen.findByLabelText('Alt text (required for a11y)');
};

describe('MediaLibraryPage (03-DESIGN 12.5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a grid of tiles', async () => {
    answer();
    setup();

    expect(await screen.findByRole('img', { name: 'A hero' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('switches to a list', async () => {
    answer([aMedia(), aMedia({ id: ID.other, uploader_name: null, filename: 'b.png' })]);
    const { user } = setup();
    await screen.findAllByRole('img', { name: 'A hero' });

    await user.click(screen.getByRole('button', { name: 'List view' }));

    expect(screen.getByRole('table', { name: 'Media' })).toBeInTheDocument();
    expect(screen.getAllByText('1.2 MB')).toHaveLength(2);
    expect(screen.getByText('Unknown')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('opens details and selects from the list too', async () => {
    answer();
    answerDetail();
    const { user } = setup();
    await screen.findByRole('img');
    await user.click(screen.getByRole('button', { name: 'List view' }));

    await user.click(screen.getByRole('checkbox', { name: 'Select hero.jpg' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();

    await user.click(screen.getByRole('cell', { name: 'hero.jpg' }));
    expect(await screen.findByLabelText('Alt text (required for a11y)')).toBeInTheDocument();
  });

  it('filters through the URL', async () => {
    const urls = answer();
    const { user } = setup();
    await screen.findByRole('img');

    await user.type(screen.getByLabelText('Search by filename or alt text'), 'cat');
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get('search')).toBe('cat');
    });

    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(screen.getByRole('option', { name: 'Documents' }));
    await user.click(screen.getByRole('button', { name: 'Mine' }));
    fireEvent.change(screen.getByLabelText('Uploaded from'), { target: { value: '2026-01-02' } });

    await waitFor(() => {
      const last = urls.at(-1)?.searchParams;
      expect(last?.get('kind')).toBe('document');
      expect(last?.get('uploaded_by')).toBe(anEditor.id);
      expect(last?.get('from')).toBe(new Date(2026, 0, 2).toISOString());
    });

    await user.click(screen.getByRole('button', { name: 'Mine' }));
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.has('uploaded_by')).toBe(false);
    });
  });

  it('pages through results', async () => {
    const urls = answer();
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get('page')).toBe('2');
    });
  });

  it('explains an empty library and an empty search', async () => {
    answer([]);
    const { unmount } = setup();
    expect(await screen.findByRole('heading', { name: 'No media yet' })).toBeInTheDocument();
    unmount();

    setup('/media?kind=image');
    expect(
      await screen.findByRole('heading', { name: 'No media matches these filters' }),
    ).toBeInTheDocument();
  });

  it('polls while a tile is still processing', async () => {
    const urls = answer([aMedia({ variant_status: 'pending' })]);
    setup();

    await screen.findByRole('progressbar', { name: 'Processing' });
    await waitFor(
      () => {
        expect(urls.length).toBeGreaterThan(1);
      },
      { timeout: 3000 },
    );
  });

  describe('uploads', () => {
    const allow = () => {
      server.use(
        http.post(`${LIST}/presign`, () =>
          HttpResponse.json({
            data: {
              upload_url: `${window.location.origin}/storage/k`,
              storage_key: 'k',
              expires_in: 900,
              headers: {},
            },
          }),
        ),
        http.put('*/storage/k', () => new HttpResponse(null, { status: 200 })),
        http.post(LIST, () => HttpResponse.json({ data: aMedia() }, { status: 201 })),
      );
    };
    const file = new File(['x'], 'new.png', { type: 'image/png' });

    it('uploads from the button', async () => {
      answer();
      allow();
      setup();

      fireEvent.change(screen.getByLabelText('Choose files to upload'), {
        target: { files: [file] },
      });

      expect(await screen.findByText('File uploaded')).toBeInTheDocument();
    });

    it('uploads what is dropped, and shows the drop zone while dragging', async () => {
      answer();
      allow();
      setup();
      const zone = screen.getByTestId('drop-zone');

      fireEvent.dragEnter(zone);
      fireEvent.dragOver(zone);
      fireEvent.dragLeave(zone);
      fireEvent.dragEnter(zone);
      fireEvent.drop(zone, { dataTransfer: { files: [file] } });

      expect(await screen.findByText('File uploaded')).toBeInTheDocument();
    });
  });

  describe('bulk delete', () => {
    const two = [aMedia(), aMedia({ id: ID.other, filename: 'b.png' })];
    const selectBoth = async (user: ReturnType<typeof setup>['user']) => {
      await user.click(await screen.findByRole('checkbox', { name: 'Select hero.jpg' }));
      await user.click(screen.getByRole('checkbox', { name: 'Select b.png' }));
    };

    it('asks, then deletes what was selected', async () => {
      answer(two);
      server.use(
        http.delete(ONE, () => new HttpResponse(null, { status: 204 })),
        http.delete(`${LIST}/${ID.other}`, () => new HttpResponse(null, { status: 204 })),
      );
      const { user } = setup();

      await selectBoth(user);
      await user.click(screen.getByRole('button', { name: 'Delete selected' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Delete 2 files?' }));
      await user.click(dialog.getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('2 files deleted')).toBeInTheDocument();
      expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
    });

    it('forgets the selection when the listing changes (03-DESIGN 13.5)', async () => {
      answer(two);
      const { user } = setup();

      await selectBoth(user);
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Next' }));

      await waitFor(() => {
        expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Delete selected' })).not.toBeInTheDocument();
    });

    it('says what could not be deleted', async () => {
      answer(two);
      server.use(
        http.delete(ONE, () => new HttpResponse(null, { status: 204 })),
        http.delete(`${LIST}/${ID.other}`, () =>
          HttpResponse.json(
            { error: { code: 'MEDIA_IN_USE', message: 'In use' } },
            { status: 409 },
          ),
        ),
      );
      const { user } = setup();

      await selectBoth(user);
      await user.click(screen.getByRole('button', { name: 'Delete selected' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

      expect(
        await screen.findByText(/1 files deleted. 1 could not be deleted/),
      ).toBeInTheDocument();
    });

    it('can back out, and deselect', async () => {
      answer(two);
      const { user } = setup();

      await selectBoth(user);
      await user.click(screen.getByRole('button', { name: 'Delete selected' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('checkbox', { name: 'Select b.png' }));
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
  });

  describe('details drawer (03-DESIGN 20.3)', () => {
    it('shows the facts and closes', async () => {
      answer();
      answerDetail({ usage_count: 0 });
      const { user } = setup();

      await openDetails(user);
      expect(screen.getByText('1920 × 1080', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('0 pieces of content', { exact: false })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', aMedia().url);
      await expectNoA11yViolations();

      await user.click(screen.getByRole('button', { name: 'Close details' }));
      await waitFor(() => {
        expect(screen.queryByLabelText('Alt text (required for a11y)')).not.toBeInTheDocument();
      });
    });

    it('handles a document, which has no preview or dimensions', async () => {
      answer();
      answerDetail({
        mime_type: 'application/pdf',
        width: null,
        height: null,
        uploader_name: null,
        alt_text: null,
        caption: 'A caption',
      });
      const { user } = setup();

      await openDetails(user);

      expect(screen.queryByText(/Dimensions/)).not.toBeInTheDocument();
      expect(screen.getByText(/Unknown ·/)).toBeInTheDocument();
      expect(screen.getByLabelText('Caption (optional)')).toHaveValue('A caption');
    });

    it('prefers the medium variant, and handles an image with no alt text', async () => {
      answer();
      answerDetail({
        alt_text: null,
        variants: { medium: { url: 'https://cdn/m.webp', width: 1024, height: 576 } },
      });
      const { user } = setup();

      await openDetails(user);

      expect(document.querySelector('img[src="https://cdn/m.webp"]')).toHaveAttribute('alt', '');
    });

    it('saves alt text and caption, and clears them with null', async () => {
      answer();
      answerDetail();
      const bodies: unknown[] = [];
      server.use(
        http.patch(ONE, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ data: aMedia() });
        }),
      );
      const { user } = setup();

      const alt = await openDetails(user);
      await user.clear(alt);
      await user.type(screen.getByLabelText('Caption (optional)'), 'Words');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Media updated')).toBeInTheDocument();
      expect(bodies).toEqual([{ alt_text: null, caption: 'Words' }]);

      await user.type(alt, 'Alt');
      await user.clear(screen.getByLabelText('Caption (optional)'));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(bodies[1]).toEqual({ alt_text: 'Alt', caption: null });
      });
    });

    it('copies the URL', async () => {
      answer();
      answerDetail();
      const { user } = setup();
      await openDetails(user);
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await user.click(screen.getByRole('button', { name: 'Copy URL' }));

      expect(writeText).toHaveBeenCalledWith(aMedia().url);
      expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
    });

    it('says when the URL could not be copied', async () => {
      answer();
      answerDetail();
      const { user } = setup();
      await openDetails(user);
      vi.stubGlobal('navigator', {
        ...navigator,
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
      });

      await user.click(screen.getByRole('button', { name: 'Copy URL' }));

      expect(await screen.findByText("Couldn't copy to clipboard")).toBeInTheDocument();
    });

    it('deletes an unused file once its name is typed (03-DESIGN 13.5)', async () => {
      answer();
      answerDetail();
      let url = '';
      server.use(
        http.delete(ONE, ({ request }) => {
          url = request.url;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const { user } = setup();

      await openDetails(user);
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Delete this file?' }));
      await user.type(dialog.getByLabelText('File name'), 'hero.jpg');
      await user.click(dialog.getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('File deleted')).toBeInTheDocument();
      expect(url).not.toContain('force');
    });

    it('can back out of deleting', async () => {
      answer();
      answerDetail();
      const { user } = setup();

      await openDetails(user);
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByLabelText('File name')).not.toBeInTheDocument();
      });
    });

    it('refuses to delete a used file, for an Editor (FR-MEDIA-07)', async () => {
      answer();
      answerDetail({ usage_count: 3 });
      const { user } = setup();

      await openDetails(user);

      expect(
        screen.getByText('Content uses this file, so it cannot be deleted.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    });

    it('lets an Admin force it, saying what it costs', async () => {
      answer();
      answerDetail({ usage_count: 3 });
      let url = '';
      server.use(
        http.delete(ONE, ({ request }) => {
          url = request.url;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const { user } = setup('/media', anAdmin);

      await openDetails(user);
      await user.click(screen.getByRole('button', { name: 'Force delete' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Force delete this file?' }));
      expect(dialog.getByText(/3 pieces of content use this file/)).toBeInTheDocument();
      await user.type(dialog.getByLabelText('File name'), 'hero.jpg');
      await user.click(dialog.getByRole('button', { name: 'Force delete' }));

      await waitFor(() => {
        expect(url).toContain('force=true');
      });
    });

    it('lets an Author change only their own upload', async () => {
      answer();
      answerDetail({ uploaded_by: ID.other });
      const { user } = setup('/media', anAuthor);

      const alt = await openDetails(user);

      expect(alt).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });
});
