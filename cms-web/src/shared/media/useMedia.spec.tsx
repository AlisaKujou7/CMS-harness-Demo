import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { aMedia, aPage } from '../../../test/builders';
import { server } from '../../../test/mocks/server';
import { Providers } from '../../../test/utils/render-with-providers';
import { pollWhileProcessing, useMediaList } from './useMedia';
import { useMediaUpload } from './useMediaUpload';

const png = (name = 'a.png') => new File(['x'], name, { type: 'image/png' });

function allowUploads() {
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
    http.post('*/api/admin/media', () => HttpResponse.json({ data: aMedia() }, { status: 201 })),
  );
}

describe('pollWhileProcessing', () => {
  it('polls only while a variant is pending', () => {
    const page = (status: 'pending' | 'ready') => ({
      data: [aMedia({ variant_status: status })],
      pagination: aPage(),
    });

    expect(pollWhileProcessing(page('pending'))).toBe(2000);
    expect(pollWhileProcessing(page('ready'))).toBe(false);
    expect(pollWhileProcessing(undefined)).toBe(false);
  });
});

describe('useMediaList', () => {
  it('asks the API with the filter', async () => {
    let search: string | null = null;
    server.use(
      http.get('*/api/admin/media', ({ request }) => {
        search = new URL(request.url).searchParams.get('search');
        return HttpResponse.json({ data: [aMedia()], pagination: aPage() });
      }),
    );

    const { result } = renderHook(() => useMediaList({ search: 'hero' }), { wrapper: Providers });

    await waitFor(() => {
      expect(result.current.data?.data).toHaveLength(1);
    });
    expect(search).toBe('hero');
  });
});

describe('useMediaUpload', () => {
  const setup = (onUploaded?: () => void) =>
    renderHook(() => useMediaUpload(onUploaded), {
      wrapper: Providers,
    });

  it('uploads and hands over the new items', async () => {
    allowUploads();
    const onUploaded = vi.fn();
    const { result } = setup(onUploaded);

    act(() => {
      result.current.start([png()]);
    });

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith([aMedia()]);
    });
    expect(result.current.progress).toBeNull();
    expect(await screen.findByText('File uploaded')).toBeInTheDocument();
  });

  it('counts several files', async () => {
    allowUploads();
    const { result } = setup();

    act(() => {
      result.current.start([png('a.png'), png('b.png')]);
    });

    expect(await screen.findByText('2 files uploaded')).toBeInTheDocument();
  });

  it('reports a refused file and sends the rest', async () => {
    allowUploads();
    const onUploaded = vi.fn();
    const { result } = setup(onUploaded);

    act(() => {
      result.current.start([
        new File(['x'], 'evil.exe', { type: 'application/x-msdownload' }),
        png(),
      ]);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('evil.exe');
    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledOnce();
    });
  });

  it('starts nothing when every file is refused', () => {
    const { result } = setup();

    act(() => {
      result.current.start([new File(['x'], 'evil.exe', { type: 'x/y' })]);
    });

    expect(result.current.progress).toBeNull();
  });

  it('names a file that failed', async () => {
    allowUploads();
    server.use(
      http.post('*/api/admin/media', () =>
        HttpResponse.json(
          { error: { code: 'X', message: 'Refused by the server' } },
          { status: 422 },
        ),
      ),
    );
    const { result } = setup();

    act(() => {
      result.current.start([png()]);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "a.png couldn't be uploaded: Refused by the server",
    );
  });

  it('stops when the screen goes away', () => {
    allowUploads();
    const { result, unmount } = setup();

    act(() => {
      result.current.start([png()]);
    });
    unmount();

    expect(result.current.progress).toBeNull();
  });
});

describe('Providers', () => {
  it('render their children', () => {
    render(<Providers>Hello</Providers>);

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
