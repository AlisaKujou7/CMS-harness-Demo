import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { aContent, aMediaDetail, aPage, ID } from '../../../../test/builders';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { renderPage, signIn } from '../../../../test/utils/render-with-providers';
import type { ContentVersionRow } from '../../../shared/api/types';
import { VersionHistoryPage } from './VersionHistoryPage';

const ONE = `*/api/admin/content/${ID.content}`;
const AT = '2026-05-15T12:00:00.000Z';

const aVersion = (no: number, editor: string | null = 'Alice'): ContentVersionRow => ({
  id: `v${String(no)}`,
  version_no: no,
  editor_id: ID.user,
  editor_name: editor,
  created_at: AT,
});

const snapshot = (body: unknown = { type: 'doc', content: [] }) => ({
  title: 'Old title',
  slug: 'old',
  body,
  status: 'draft',
  featured_image_id: null,
  social_image_id: null,
  seo_title: null,
  seo_description: null,
  tags: [],
  category: null,
  parent_id: null,
});

function answer(
  body?: unknown,
  versions: readonly ContentVersionRow[] = [aVersion(2), aVersion(1, null)],
) {
  server.use(
    http.get(`${ONE}/versions`, () => HttpResponse.json({ data: versions, pagination: aPage() })),
    http.get(`${ONE}/versions/1`, () =>
      HttpResponse.json({
        data: {
          id: 'v1',
          version_no: 1,
          editor_id: ID.user,
          created_at: AT,
          snapshot: snapshot(body),
        },
      }),
    ),
  );
}

function setup() {
  signIn();
  const path = '/content/articles/:id/versions';
  return renderPage(<VersionHistoryPage type="article" />, {
    route: `/content/articles/${ID.content}/versions`,
    path,
  });
}

const pick = async (user: ReturnType<typeof setup>['user']) => {
  await user.click(await screen.findByRole('button', { name: /Version 1/ }));
  return screen.findByRole('heading', { name: 'Old title' });
};

describe('VersionHistoryPage (03-DESIGN 19.5)', () => {
  it('lists versions with who and when, and links back', async () => {
    answer();
    setup();

    expect(await screen.findByRole('button', { name: /Version 2.*Alice/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Version 1.*Someone/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the editor' })).toHaveAttribute(
      'href',
      `/content/articles/${ID.content}`,
    );
    expect(screen.getByText('Select a version to preview it')).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('explains an empty history', async () => {
    answer(undefined, []);
    setup();

    expect(
      await screen.findByRole('heading', { name: 'No earlier versions yet' }),
    ).toBeInTheDocument();
  });

  it('previews a version read-only, with a warning', async () => {
    answer({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old words' }] }],
    });
    const { user } = setup();

    await pick(user);

    expect(await screen.findByText('Old words')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('This is a previous version');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows images in a preview with a current URL', async () => {
    answer({
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'https://expired', alt: 'Hero', mediaId: ID.media } },
      ],
    });
    server.use(
      http.get(`*/api/admin/media/${ID.media}`, () =>
        HttpResponse.json({ data: aMediaDetail({ url: 'https://fresh/x' }) }),
      ),
    );
    const { user } = setup();

    await pick(user);

    expect(await screen.findByRole('img', { name: 'Hero' })).toHaveAttribute(
      'src',
      'https://fresh/x',
    );
  });

  it('asks, reverts, and returns to the editor', async () => {
    answer();
    server.use(http.post(`${ONE}/revert/1`, () => HttpResponse.json({ data: aContent() })));
    const { user, router } = setup();

    await pick(user);
    await user.click(screen.getByRole('button', { name: 'Revert to this version' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Revert to version 1?' }));
    await user.click(dialog.getByRole('button', { name: 'Revert to this version' }));

    expect(await screen.findByText('Reverted to version 1')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/content/articles/${ID.content}`);
    });
  });

  it('says when images could not come back (ADR-0013)', async () => {
    answer({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://x', alt: 'Gone', mediaId: ID.media } }],
    });
    server.use(
      http.get(`*/api/admin/media/${ID.media}`, () => new HttpResponse(null, { status: 404 })),
      http.post(`${ONE}/revert/1`, () => HttpResponse.json({ data: aContent() })),
    );
    const { user } = setup();

    await pick(user);
    await user.click(screen.getByRole('button', { name: 'Revert to this version' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Revert to this version',
      }),
    );

    expect(await screen.findByText(/1 images no longer exist/)).toBeInTheDocument();
  });

  it('can back out of reverting', async () => {
    answer();
    const { user } = setup();

    await pick(user);
    await user.click(screen.getByRole('button', { name: 'Revert to this version' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
