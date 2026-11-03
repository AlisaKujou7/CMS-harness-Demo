import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { aContent, aMedia, aMediaDetail, aPage, aListRow, ID } from '../../../../test/builders';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import {
  anAuthor,
  anEditor,
  renderPage,
  signIn,
} from '../../../../test/utils/render-with-providers';
import type { ContentDetail, ContentType } from '../../../shared/api/types';
import { ContentEditorPage } from './ContentEditorPage';

const LIST = '*/api/admin/content';
const ONE = `${LIST}/${ID.content}`;
const PATH = `/content/articles/${ID.content}`;

function answerCatalogs() {
  server.use(
    http.get(`${LIST}/categories`, () => HttpResponse.json({ data: ['news', 'guides'] })),
    http.get(LIST, () =>
      HttpResponse.json({
        data: [aListRow({ id: ID.other, type: 'page', title: 'About' })],
        pagination: aPage(),
      }),
    ),
  );
}

function answer(content: ContentDetail = aContent()) {
  answerCatalogs();
  server.use(http.get(ONE, () => HttpResponse.json({ data: content })));
}

function capturePatch(result: Partial<ContentDetail> = {}) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.patch(ONE, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return HttpResponse.json({
        data: { ...aContent(), ...body, version: Number(body['version']) + 1, ...result },
      });
    }),
  );
  return bodies;
}

function setup(route = PATH, user = anEditor, type: ContentType = 'article') {
  signIn(user);
  const element = <ContentEditorPage type={type} />;
  const prefix = type === 'article' ? 'articles' : 'pages';
  return renderPage(element, {
    route,
    path: `/content/${prefix}/:id`,
    routes: [{ path: `/content/${prefix}`, element: <div>The list</div> }],
  });
}

const titleField = () => screen.findByLabelText('Title');
const editorReady = () => screen.findByRole('textbox', { name: 'Body' });

describe('ContentEditorPage (03-DESIGN 12.4)', () => {
  it('loads the content into the form, with no accessibility violations', async () => {
    answer(aContent({ title: 'Q2', slug: 'q2', seo_title: 'SEO', category: 'news', tags: ['a'] }));
    setup();

    expect(await titleField()).toHaveValue('Q2');
    expect(screen.getByLabelText('Slug')).toHaveValue('q2');
    expect(screen.getByLabelText('Meta Title')).toHaveValue('SEO');
    expect(screen.getByText('3/70')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    await editorReady();
    await expectNoA11yViolations();
  });

  it('shows the error screen when it cannot load', async () => {
    answerCatalogs();
    server.use(http.get(ONE, () => new HttpResponse(null, { status: 404 })));
    setup();

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('creates on first save with what was typed, keeping the form in place', async () => {
    answerCatalogs();
    let body: unknown;
    server.use(
      http.post(LIST, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { data: aContent({ title: 'First', slug: 'first' }) },
          { status: 201 },
        );
      }),
    );
    const { user, router } = setup('/content/articles/new');

    await editorReady();
    const title = await titleField();
    await user.type(title, 'First');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(PATH);
    });
    expect(body).toEqual({ type: 'article', title: 'First' });
    expect(title).toBeInTheDocument();
    expect(title).toHaveValue('First');
    expect(screen.getByLabelText('Slug')).toHaveValue('first');
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });

  it('asks for a title before saving a new item', async () => {
    answerCatalogs();
    const { user } = setup('/content/articles/new');

    await editorReady();
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(await screen.findByText('A title is required')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Fix the highlighted fields');
    expect(screen.queryByRole('button', { name: 'Submit for Review' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View version history' })).not.toBeInTheDocument();
  });

  it('saves only what changed, with the version it loaded (ADR-0013)', async () => {
    answer(aContent({ version: 4 }));
    const bodies = capturePatch();
    const { user } = setup();

    await editorReady();
    await user.type(await titleField(), '!');
    await user.tab();

    await waitFor(() => {
      expect(bodies).toEqual([{ title: 'Q2 Report!', version: 4 }]);
    });
    expect(await screen.findByText(/^Saved/)).toBeInTheDocument();
  });

  it('uses the new version for the next save', async () => {
    answer(aContent({ version: 4 }));
    const bodies = capturePatch();
    const { user } = setup();

    await editorReady();
    const seo = screen.getByLabelText('Meta Title');
    await user.type(seo, 'A');
    await user.tab();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    await user.type(seo, 'B');
    await user.tab();

    await waitFor(() => {
      expect(bodies[1]).toEqual({ seo_title: 'AB', version: 5 });
    });
  });

  it('saves nothing when nothing changed', async () => {
    answer();
    const bodies = capturePatch();
    const { user } = setup();

    await editorReady();
    await user.click(await titleField());
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('marks a field the server refuses', async () => {
    answer();
    server.use(
      http.patch(ONE, () =>
        HttpResponse.json(
          {
            error: {
              code: 'SLUG_TAKEN',
              message: 'Slug already exists for this content type',
              details: { field: 'slug' },
            },
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = setup();

    await editorReady();
    const slug = screen.getByLabelText('Slug');
    await user.clear(slug);
    await user.type(slug, 'taken');
    await user.tab();

    expect(
      await screen.findByText('Slug already exists for this content type'),
    ).toBeInTheDocument();
    expect(screen.getByText("Couldn't save.")).toBeInTheDocument();
  });

  it('shows any other refusal as a toast', async () => {
    answer();
    server.use(
      http.patch(ONE, () =>
        HttpResponse.json(
          { error: { code: 'CONTENT_SCHEDULED', message: 'It is scheduled' } },
          { status: 409 },
        ),
      ),
    );
    const { user } = setup();

    await editorReady();
    await user.type(await titleField(), '!');
    await user.tab();

    expect(await screen.findByText('It is scheduled')).toBeInTheDocument();
  });

  it('does not save what fails its own validation', async () => {
    answer();
    const bodies = capturePatch();
    const { user } = setup();

    await editorReady();
    await user.type(screen.getByLabelText('Slug'), ' Bad');
    await user.tab();

    expect(
      await screen.findByText('Use lowercase letters, digits and single hyphens'),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  describe('someone else saved first (03-DESIGN 19.4)', () => {
    const conflict = () =>
      http.patch(ONE, () =>
        HttpResponse.json(
          { error: { code: 'CONTENT_CHANGED', message: 'Changed' } },
          { status: 409 },
        ),
      );

    it('offers to reload the latest version', async () => {
      answer();
      server.use(conflict());
      const { user } = setup();

      await editorReady();
      await user.type(await titleField(), '!');
      await user.tab();
      const dialog = within(await screen.findByRole('dialog', { name: 'This content changed' }));

      server.use(
        http.get(ONE, () => HttpResponse.json({ data: aContent({ title: 'Theirs', version: 9 }) })),
      );
      await user.click(dialog.getByRole('button', { name: 'Reload' }));

      await waitFor(async () => {
        expect(await titleField()).toHaveValue('Theirs');
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('offers to save a copy as a new draft', async () => {
      answer();
      server.use(conflict());
      let body: Record<string, unknown> = {};
      server.use(
        http.post(LIST, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ data: aContent({ id: ID.other }) }, { status: 201 });
        }),
        http.get(`${LIST}/${ID.other}`, () =>
          HttpResponse.json({ data: aContent({ id: ID.other }) }),
        ),
      );
      const { user, router } = setup();

      await editorReady();
      await user.type(await titleField(), '!');
      await user.tab();
      const dialog = within(await screen.findByRole('dialog'));
      await user.click(dialog.getByRole('button', { name: 'Save a copy' }));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/content/articles/${ID.other}`);
      });
      expect(body).toEqual({ type: 'article', title: 'Copy of Q2 Report!' });
    });
  });

  describe('lifecycle', () => {
    const action = (path: string, result: Partial<ContentDetail>) =>
      http.post(`${ONE}/${path}`, () => HttpResponse.json({ data: aContent(result) }));

    it('saves first, then publishes', async () => {
      answer();
      const bodies = capturePatch();
      const order: string[] = [];
      server.use(
        http.post(`${ONE}/publish`, () => {
          order.push(`publish after ${String(bodies.length)} saves`);
          return HttpResponse.json({ data: aContent({ status: 'published', version: 3 }) });
        }),
      );
      const { user } = setup();

      await editorReady();
      await user.type(await titleField(), '!');
      await user.click(screen.getByRole('button', { name: 'Publish' }));

      expect(await screen.findByText('Article published')).toBeInTheDocument();
      expect(order).toEqual(['publish after 1 saves']);
      expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    });

    it('names what publishing still needs', async () => {
      answer();
      server.use(
        http.post(`${ONE}/publish`, () =>
          HttpResponse.json(
            {
              error: {
                code: 'MISSING_REQUIRED_FIELDS',
                message: 'Missing',
                details: { fields: ['body', 'seoDescription'] },
              },
            },
            { status: 422 },
          ),
        ),
      );
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Publish' }));

      expect(
        await screen.findByText('Publishing needs: body, seoDescription.'),
      ).toBeInTheDocument();
    });

    it('does not publish when the save failed', async () => {
      answer();
      const publish = vi.fn(() => HttpResponse.json({ data: aContent() }));
      server.use(
        http.post(`${ONE}/publish`, publish),
        http.patch(ONE, () =>
          HttpResponse.json({ error: { code: 'X', message: 'No' } }, { status: 422 }),
        ),
      );
      const { user } = setup();

      await editorReady();
      await user.type(await titleField(), '!');
      await user.click(screen.getByRole('button', { name: 'Publish' }));

      expect(await screen.findByText('No')).toBeInTheDocument();
      expect(publish).not.toHaveBeenCalled();
    });

    it('submits for review', async () => {
      answer();
      server.use(action('submit', { status: 'in_review' }));
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Submit for Review' }));

      expect(await screen.findByText('Article submitted for review')).toBeInTheDocument();
    });

    it('rejects with a note', async () => {
      answer(aContent({ status: 'in_review' }));
      let body: unknown;
      server.use(
        http.post(`${ONE}/reject`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ data: aContent({ review_note: 'Fix it' }) });
        }),
      );
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Reject' }));
      const dialog = within(screen.getByRole('dialog'));
      await user.type(dialog.getByLabelText('Note for the author (optional)'), 'Fix it');
      await user.click(dialog.getByRole('button', { name: 'Reject' }));

      expect(await screen.findByText('Sent back with this note: Fix it')).toBeInTheDocument();
      expect(body).toEqual({ note: 'Fix it' });
    });

    it('can back out of a rejection', async () => {
      answer(aContent({ status: 'in_review' }));
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Reject' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('schedules, shows when, and can cancel it', async () => {
      answer();
      const sent: unknown[] = [];
      server.use(
        http.post(`${ONE}/schedule`, async ({ request }) => {
          const body = (await request.json()) as { scheduled_at: string | null };
          sent.push(body.scheduled_at);
          return HttpResponse.json({ data: aContent({ scheduled_at: body.scheduled_at }) });
        }),
      );
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Schedule...' }));
      fireEvent.change(screen.getByLabelText('Publish on'), {
        target: { value: '2030-01-01T09:00' },
      });
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Schedule' }),
      );

      expect(await screen.findByText(/scheduled to publish on/)).toBeInTheDocument();
      expect(await screen.findByText('Article scheduled')).toBeInTheDocument();
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(new Date(String(sent[0])).toISOString()).toBe(new Date(2030, 0, 1, 9).toISOString());

      await user.click(screen.getByRole('button', { name: 'Cancel schedule' }));
      await waitFor(() => {
        expect(sent[1]).toBeNull();
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel schedule' })).not.toBeInTheDocument();
      });
    });

    it('refuses a time in the past, and can be cancelled', async () => {
      answer();
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Schedule...' }));
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.change(dialog.getByLabelText('Publish on'), {
        target: { value: '2000-01-01T09:00' },
      });

      expect(dialog.getByText('Choose a time in the future')).toBeInTheDocument();
      expect(dialog.getByRole('button', { name: 'Schedule' })).toBeDisabled();

      fireEvent.change(dialog.getByLabelText('Publish on'), { target: { value: '' } });
      expect(dialog.getByRole('button', { name: 'Schedule' })).toBeDisabled();

      await user.click(dialog.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('asks before unpublishing and archiving', async () => {
      answer(aContent({ status: 'published' }));
      server.use(
        action('unpublish', { status: 'unpublished' }),
        action('archive', { status: 'archived' }),
      );
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Unpublish' }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Unpublish' }),
      );
      expect(await screen.findByText('Article unpublished')).toBeInTheDocument();

      await user.click(await screen.findByRole('button', { name: 'Archive' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
      expect(await screen.findByText(/read this, but not edit/)).toBeInTheDocument();
    });

    it('deletes and goes back to the list', async () => {
      answer();
      server.use(http.delete(ONE, () => new HttpResponse(null, { status: 204 })));
      const { user, router } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/content/articles');
      });
    });

    it('can back out of deleting', async () => {
      answer();
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('what an Author sees', () => {
    it('keeps Publish visible but disabled, and offers no moderation', async () => {
      answer(aContent({ author_id: anAuthor.id }));
      setup(PATH, anAuthor);

      await editorReady();
      expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Schedule...' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('is read-only while the content is with the Editors, and saves nothing', async () => {
      answer(aContent({ author_id: anAuthor.id, status: 'in_review' }));
      const bodies = capturePatch();
      const { user } = setup(PATH, anAuthor);

      await editorReady();
      expect(screen.getByText(/read this, but not edit/)).toBeInTheDocument();
      expect(await titleField()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument();

      await user.click(
        screen.getByRole('button', { name: 'Publish' }).parentElement as HTMLElement,
      );
      expect(bodies).toEqual([]);
    });

    it("hides the history of someone else's published article", async () => {
      answer(aContent({ status: 'published' }));
      setup(PATH, anAuthor);

      await editorReady();
      expect(screen.queryByRole('link', { name: 'View version history' })).not.toBeInTheDocument();
    });
  });

  it('links to the version history', async () => {
    answer();
    setup();

    await editorReady();
    expect(screen.getByRole('link', { name: 'View version history' })).toHaveAttribute(
      'href',
      `${PATH}/versions`,
    );
  });

  describe('unsaved changes (02-SRS 4.1)', () => {
    it('asks before leaving, and can stay or go', async () => {
      answer();
      const { user, router } = setup();

      await editorReady();
      await user.type(await titleField(), '!');
      void router.navigate('/content/articles');

      const dialog = await screen.findByRole('dialog', { name: 'Leave without saving?' });
      await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(PATH);
      });

      void router.navigate('/content/articles');
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave' }),
      );
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/content/articles');
      });
    });

    it('lets you leave when everything is saved', async () => {
      answer();
      const { router } = setup();

      await editorReady();
      act(() => {
        void router.navigate('/content/articles');
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/content/articles');
      });
    });

    it('warns the browser only when there is something to lose', async () => {
      answer();
      const { user } = setup();
      await editorReady();

      const unchanged = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unchanged);
      expect(unchanged.defaultPrevented).toBe(false);

      await user.type(await titleField(), '!');
      const changed = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(changed);
      expect(changed.defaultPrevented).toBe(true);
    });
  });

  describe('metadata', () => {
    it('adds and removes tags', async () => {
      answer();
      const bodies = capturePatch();
      const { user } = setup();

      await editorReady();
      await user.type(screen.getByLabelText('Add tag'), ' News {Enter}');
      await user.type(screen.getByLabelText('Add tag'), 'news{Enter}');
      await user.type(screen.getByLabelText('Add tag'), 'x');
      expect(screen.getAllByText('news')).toHaveLength(1);
      await user.clear(screen.getByLabelText('Add tag'));
      await user.type(screen.getByLabelText('Add tag'), '{Enter}');

      await user.click(screen.getByRole('button', { name: 'Save Draft' }));
      await waitFor(() => {
        expect(bodies).toEqual([{ tags: ['news'], version: 1 }]);
      });

      await user.click(screen.getByTitle('Remove tag news'));
      expect(screen.queryByText('news')).not.toBeInTheDocument();
    });

    it('chooses a category from the predefined list', async () => {
      answer();
      const bodies = capturePatch();
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('combobox', { name: 'Category' }));
      await user.click(await screen.findByRole('option', { name: 'news' }));
      await user.click(screen.getByRole('button', { name: 'Save Draft' }));

      await waitFor(() => {
        expect(bodies).toEqual([{ category: 'news', version: 1 }]);
      });
    });

    it('chooses a parent for a page, and never the page itself', async () => {
      answerCatalogs();
      const self = aListRow({ id: ID.content, type: 'page', title: 'Myself' });
      server.use(
        http.get(LIST, () =>
          HttpResponse.json({
            data: [self, aListRow({ id: ID.other, type: 'page', title: 'About' })],
            pagination: aPage(),
          }),
        ),
        http.get(ONE, () => HttpResponse.json({ data: aContent({ type: 'page' }) })),
      );
      const { user } = setup(`/content/pages/${ID.content}`, anEditor, 'page');

      await editorReady();
      expect(screen.queryByLabelText('Add tag')).not.toBeInTheDocument();
      await user.click(screen.getByRole('combobox', { name: 'Parent page' }));

      expect(await screen.findByRole('option', { name: 'About' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Myself' })).not.toBeInTheDocument();
    });

    it('shows, replaces and removes a featured image', async () => {
      answer(aContent({ featured_image_id: ID.media }));
      const bodies = capturePatch();
      server.use(
        http.get(`*/api/admin/media/${ID.media}`, () =>
          HttpResponse.json({ data: aMediaDetail() }),
        ),
        http.get('*/api/admin/media', () =>
          HttpResponse.json({
            data: [aMedia({ id: ID.other, filename: 'new.jpg' })],
            pagination: aPage(),
          }),
        ),
      );
      const { user } = setup();

      await editorReady();
      expect(await screen.findByRole('img', { name: 'A hero' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Select image: Featured Image' }));
      await user.click(await screen.findByRole('button', { name: /new.jpg/ }));
      await user.click(screen.getByRole('button', { name: 'Insert' }));
      await user.click(screen.getByRole('button', { name: 'Save Draft' }));
      await waitFor(() => {
        expect(bodies[0]).toEqual({ featured_image_id: ID.other, version: 1 });
      });

      await user.click(screen.getByRole('button', { name: 'Remove image: Featured Image' }));
      await user.click(screen.getByRole('button', { name: 'Save Draft' }));
      await waitFor(() => {
        expect(bodies[1]).toEqual({ featured_image_id: null, version: 2 });
      });
    });

    it('says when a chosen image no longer exists', async () => {
      answer(aContent({ social_image_id: ID.media }));
      server.use(
        http.get(`*/api/admin/media/${ID.media}`, () => new HttpResponse(null, { status: 404 })),
      );
      setup();

      expect(await screen.findByText('This image no longer exists')).toBeInTheDocument();
    });

    it('can back out of choosing an image', async () => {
      answer();
      server.use(
        http.get('*/api/admin/media', () => HttpResponse.json({ data: [], pagination: aPage() })),
      );
      const { user } = setup();

      await editorReady();
      await user.click(screen.getByRole('button', { name: 'Select image: Social Image' }));
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('inline images (ADR-0013)', () => {
    const body = (mediaId: string) => ({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://expired/x', alt: 'Hero', mediaId } }],
    });

    it('shows a current URL, and does not count it as a change', async () => {
      answer(aContent({ body: body(ID.media) }));
      const bodies = capturePatch();
      server.use(
        http.get(`*/api/admin/media/${ID.media}`, () =>
          HttpResponse.json({ data: aMediaDetail({ url: 'https://fresh/x' }) }),
        ),
      );
      const { user } = setup();

      expect(await screen.findByRole('img', { name: 'Hero' })).toHaveAttribute(
        'src',
        'https://fresh/x',
      );
      await user.click(screen.getByRole('button', { name: 'Save Draft' }));

      expect(await screen.findByText('Draft saved')).toBeInTheDocument();
      expect(bodies).toEqual([]);
    });

    it('keeps the dead reference of an image that was force-deleted', async () => {
      answer(aContent({ body: body(ID.media) }));
      server.use(
        http.get(`*/api/admin/media/${ID.media}`, () => new HttpResponse(null, { status: 404 })),
      );
      setup();

      expect(await screen.findByRole('img', { name: 'Hero' })).toHaveAttribute(
        'src',
        'https://expired/x',
      );
    });
  });
});
