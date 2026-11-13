import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { aMedia, aPage } from '../../../test/builders';
import { server } from '../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../test/utils/a11y';
import { renderPage, renderWithTheme } from '../../../test/utils/render-with-providers';
import { MediaPickerContainer } from './MediaPickerContainer';
import { MediaTile } from './MediaTile';
import { UploadBanner } from './UploadBanner';
import { UploadButton } from './UploadButton';
import { emptySummary } from './upload.stream';

const LIST = '*/api/admin/media';

describe('MediaTile', () => {
  const noop = vi.fn();

  it('prefers the thumbnail', async () => {
    renderWithTheme(<MediaTile item={aMedia()} onOpen={noop} />);

    expect(screen.getByRole('img', { name: 'A hero' })).toHaveAttribute(
      'src',
      aMedia().variants['thumbnail']?.url,
    );
    await expectNoA11yViolations();
  });

  it('falls back to the original, and has empty alt text for an undescribed image', () => {
    const { container } = renderWithTheme(
      <MediaTile item={aMedia({ variants: {}, alt_text: null })} onOpen={noop} />,
    );

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', aMedia().url);
    expect(image).toHaveAttribute('alt', '');
  });

  it('shows progress while variants are made', () => {
    renderWithTheme(<MediaTile item={aMedia({ variant_status: 'pending' })} onOpen={noop} />);

    expect(screen.getByRole('progressbar', { name: 'Processing' })).toBeInTheDocument();
  });

  it('shows a document icon for a PDF', () => {
    const { container } = renderWithTheme(
      <MediaTile item={aMedia({ mime_type: 'application/pdf' })} onOpen={noop} />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('hero.jpg')).toBeInTheDocument();
  });

  it('opens when pressed and can be ticked separately', async () => {
    const onOpen = vi.fn();
    const onCheck = vi.fn();
    const { user } = renderWithTheme(
      <MediaTile item={aMedia()} checkLabel="Select hero.jpg" onOpen={onOpen} onCheck={onCheck} />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Select hero.jpg' }));
    expect(onCheck).toHaveBeenCalledWith(aMedia());
    expect(onOpen).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /hero.jpg/ }));
    expect(onOpen).toHaveBeenCalledWith(aMedia());
  });

  it('marks the selected tile with more than color', () => {
    renderWithTheme(<MediaTile item={aMedia()} selected onOpen={noop} />);

    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();
    expect(screen.getByTitle('Selected')).toBeInTheDocument();
  });
});

describe('UploadBanner', () => {
  it('shows nothing when idle', () => {
    const { container } = renderWithTheme(<UploadBanner progress={null} />);

    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('counts the file in progress, and never past the total', () => {
    const progress = { ...emptySummary(5), finished: 2, percent: 67 };
    const { rerender } = renderWithTheme(<UploadBanner progress={progress} />);

    expect(screen.getByRole('status')).toHaveTextContent('Uploading 3 of 5 files... 67%');

    rerender(<UploadBanner progress={{ ...progress, finished: 5, percent: 100 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Uploading 5 of 5 files... 100%');
  });
});

describe('UploadButton', () => {
  it('hands over the chosen files', () => {
    const onFiles = vi.fn();
    renderWithTheme(<UploadButton label="Upload" onFiles={onFiles} />);
    const file = new File(['x'], 'a.png', { type: 'image/png' });

    fireEvent.change(screen.getByLabelText('Choose files to upload'), {
      target: { files: [file] },
    });

    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('copes with no selection', () => {
    const onFiles = vi.fn();
    renderWithTheme(<UploadButton label="Upload" onFiles={onFiles} />);

    fireEvent.change(screen.getByLabelText('Choose files to upload'), { target: { files: null } });

    expect(onFiles).toHaveBeenCalledWith([]);
  });
});

describe('MediaPickerContainer', () => {
  const answer = (rows = [aMedia()]) => {
    const kinds: (string | null)[] = [];
    const searches: (string | null)[] = [];
    server.use(
      http.get(LIST, ({ request }) => {
        const params = new URL(request.url).searchParams;
        kinds.push(params.get('kind'));
        searches.push(params.get('search'));
        return HttpResponse.json({ data: rows, pagination: aPage() });
      }),
    );
    return { kinds, searches };
  };

  it('offers images, and inserts only once one is selected', async () => {
    const { kinds } = answer();
    const onInsert = vi.fn();
    const { user } = renderPage(
      <MediaPickerContainer open onInsert={onInsert} onClose={vi.fn()} />,
    );

    const tile = await screen.findByRole('button', { name: /hero.jpg/ });
    await expectNoA11yViolations();
    expect(kinds).toEqual(['image']);
    expect(screen.getByRole('button', { name: 'Insert' })).toBeDisabled();

    await user.click(tile);
    await user.click(screen.getByRole('button', { name: 'Insert' }));

    expect(onInsert).toHaveBeenCalledWith(aMedia());
  });

  it('searches as the user types', async () => {
    const { searches } = answer();
    const { user } = renderPage(<MediaPickerContainer open onInsert={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Search by filename or alt text'), 'cat');

    await waitFor(() => {
      expect(searches).toContain('cat');
    });
  });

  it('says when nothing is found', async () => {
    answer([]);
    renderPage(<MediaPickerContainer open onInsert={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'No media found' })).toBeInTheDocument();
  });

  it('selects what was just uploaded', async () => {
    answer();
    server.use(
      http.post('*/api/admin/media/presign', () =>
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
    renderPage(<MediaPickerContainer open onInsert={vi.fn()} onClose={vi.fn()} />);
    await screen.findByRole('button', { name: /hero.jpg/ });

    fireEvent.change(screen.getByLabelText('Choose files to upload'), {
      target: { files: [new File(['x'], 'new.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Insert' })).toBeEnabled();
    });
  });

  it('can be cancelled', async () => {
    answer();
    const onClose = vi.fn();
    const { user } = renderPage(<MediaPickerContainer open onInsert={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
