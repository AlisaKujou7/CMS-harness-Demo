import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { aContent, aListRow, aPage, ID } from '../../../../test/builders';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import {
  anAuthor,
  anEditor,
  renderPage,
  signIn,
} from '../../../../test/utils/render-with-providers';
import type { ContentListRow, ContentType } from '../../../shared/api/types';
import { ContentListPage } from './ContentListPage';

const LIST = '*/api/admin/content';
const ONE = `${LIST}/${ID.content}`;

function answer(rows: readonly ContentListRow[] = [aListRow()]) {
  const urls: URL[] = [];
  server.use(
    http.get(LIST, ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({ data: rows, pagination: aPage({ total_pages: 3 }) });
    }),
  );
  return urls;
}

function setup(route = '/content/articles', type: ContentType = 'article', user = anEditor) {
  signIn(user);
  return renderPage(<ContentListPage type={type} />, { route });
}

async function openMenu(user: ReturnType<typeof setup>['user'], title = 'Q2 Report') {
  await user.click(await screen.findByRole('button', { name: `More actions for ${title}` }));
}

describe('ContentListPage (03-DESIGN 12.3)', () => {
  it('lists content with its status, author and age', async () => {
    const urls = answer([aListRow({ status: 'published' })]);
    setup();

    const row = (await screen.findByRole('link', { name: 'Q2 Report' })).closest('tr');
    expect(within(row as HTMLElement).getByText('Published')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Alice')).toBeInTheDocument();
    expect(urls[0]?.searchParams.get('type')).toBe('article');
    await expectNoA11yViolations();
  });

  it('shows Scheduled for what is scheduled, derived from the date', async () => {
    answer([aListRow({ scheduled_at: '2030-01-01T00:00:00Z' })]);
    setup();

    expect(await screen.findByText('Scheduled')).toBeInTheDocument();
  });

  it('opens the editor from a row or its link', async () => {
    answer();
    const { user, router } = setup();

    await user.click(await screen.findByText('Alice'));
    expect(router.state.location.pathname).toBe(`/content/articles/${ID.content}`);
  });

  it('follows the title link without also pressing the row', async () => {
    answer();
    const { user, router } = setup();

    await user.click(await screen.findByRole('link', { name: 'Q2 Report' }));

    expect(router.state.location.pathname).toBe(`/content/articles/${ID.content}`);
  });

  it('moves between articles and pages', async () => {
    answer();
    const { user, router } = setup();

    await user.click(screen.getByRole('tab', { name: 'Pages' }));

    expect(router.state.location.pathname).toBe('/content/pages');
  });

  it('creates a new item of the type shown', async () => {
    answer();
    const { user, router } = setup('/content/pages', 'page');

    await user.click(screen.getByRole('button', { name: 'New Page' }));

    expect(router.state.location.pathname).toBe('/content/pages/new');
  });

  it('filters by status through the URL, and goes back to All', async () => {
    const urls = answer();
    const { user, router } = setup('/content/articles?page=2');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get('status')).toBe('draft');
    });
    expect(router.state.location.search).toBe('?status=draft');
    expect(screen.getByRole('button', { name: 'Draft' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.has('status')).toBe(false);
    });
  });

  it('toggles Mine and Last 30 days', async () => {
    const urls = answer();
    const { user } = setup();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Mine' }));
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get('author_id')).toBe(anEditor.id);
    });

    await user.click(screen.getByRole('button', { name: 'Mine' }));
    await user.click(screen.getByRole('button', { name: 'Last 30 days' }));
    await waitFor(() => {
      const last = urls.at(-1)?.searchParams;
      expect(last?.has('author_id')).toBe(false);
      expect(last?.has('from')).toBe(true);
    });
  });

  it('searches after a pause, not on every key', async () => {
    const urls = answer();
    const { user } = setup();
    await screen.findByRole('table');
    const before = urls.length;

    await user.type(screen.getByLabelText('Search by title'), 'q2');

    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get('search')).toBe('q2');
    });
    expect(urls.length - before).toBe(1);
  });

  it('offers author, tag, date and page size under More filters', async () => {
    const urls = answer();
    const { user } = setup();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'More filters' }));
    await expectNoA11yViolations();
    await user.click(screen.getByRole('combobox', { name: 'Author' }));
    await user.click(screen.getByRole('option', { name: 'Alice' }));
    await user.click(screen.getByRole('combobox', { name: 'Rows per page' }));
    await user.click(screen.getByRole('option', { name: '50' }));
    await user.type(screen.getByLabelText('Tag'), 'n');

    await waitFor(() => {
      const last = urls.at(-1)?.searchParams;
      expect(last?.get('author_id')).toBe(ID.user);
      expect(last?.get('page_size')).toBe('50');
      expect(last?.get('tag')).toBe('n');
    });

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('sorts by the columns the API can sort', async () => {
    const urls = answer();
    const { user } = setup();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Title' }));
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get('sort')).toBe('title');
    });

    await user.click(screen.getByRole('button', { name: 'Updated' }));
    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get('sort')).toBe('updated_at');
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

  it('invites a first item when there is nothing yet', async () => {
    answer([]);
    const { user, router } = setup();

    expect(await screen.findByRole('heading', { name: 'No articles yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    const empty = screen.getByRole('heading', { name: 'No articles yet' }).parentElement;
    await user.click(within(empty as HTMLElement).getByRole('button', { name: 'New Article' }));
    expect(router.state.location.pathname).toBe('/content/articles/new');
  });

  it('offers to clear filters that match nothing (03-DESIGN 14.1)', async () => {
    answer([]);
    const { user, router } = setup('/content/articles?status=draft&search=zzz');

    expect(
      await screen.findByRole('heading', { name: 'No content matches these filters' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.search).toBe('');
    expect(screen.getByLabelText('Search by title')).toHaveValue('');
  });

  it('goes to the last page when this one no longer exists', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(LIST, ({ request }) => {
        const url = new URL(request.url);
        urls.push(url);
        const past = url.searchParams.get('page') === '3';
        return HttpResponse.json({
          data: past ? [] : [aListRow()],
          pagination: aPage({ page: past ? 3 : 2, total: 26, total_pages: 2 }),
        });
      }),
    );
    const { router } = setup('/content/articles?page=3');

    expect(await screen.findByRole('link', { name: 'Q2 Report' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.queryByRole('heading', { name: 'No articles yet' })).not.toBeInTheDocument();
  });

  it('offers a retry when the list fails', async () => {
    server.use(http.get(LIST, () => new HttpResponse(null, { status: 500 })));
    setup();

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  describe('row menu', () => {
    const items = () => screen.getAllByRole('menuitem').map((item) => item.textContent);

    it.each<[ContentListRow['status'], string[]]>([
      ['draft', ['View', 'Edit', 'Duplicate', 'Submit for Review', 'Publish', 'Delete']],
      ['in_review', ['View', 'Edit', 'Duplicate', 'Publish', 'Delete']],
      ['published', ['View', 'Edit', 'Duplicate', 'Unpublish', 'Delete']],
      ['unpublished', ['View', 'Edit', 'Duplicate', 'Archive', 'Delete']],
      ['archived', ['View', 'Duplicate', 'Delete']],
    ])('offers an Editor what suits %s', async (status, expected) => {
      answer([aListRow({ status })]);
      const { user } = setup();

      await openMenu(user);

      expect(items()).toEqual(expected);
    });

    it('offers an Author less', async () => {
      answer([aListRow({ author_id: anAuthor.id })]);
      const { user } = setup('/content/articles', 'article', anAuthor);

      await openMenu(user);

      expect(items()).toEqual(['View', 'Edit', 'Duplicate', 'Submit for Review']);
    });

    it('opens the editor from View and Edit', async () => {
      answer();
      const { user, router } = setup();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'View' }));
      expect(router.state.location.pathname).toContain(ID.content);
    });

    it('opens the editor from Edit', async () => {
      answer();
      const { user, router } = setup();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
      expect(router.state.location.pathname).toContain(ID.content);
    });

    it('submits and publishes straight away', async () => {
      answer();
      const submit = vi.fn(() => HttpResponse.json({ data: aContent({ status: 'in_review' }) }));
      const publish = vi.fn(() => HttpResponse.json({ data: aContent({ status: 'published' }) }));
      server.use(http.post(`${ONE}/submit`, submit), http.post(`${ONE}/publish`, publish));
      const { user } = setup();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Submit for Review' }));
      expect(await screen.findByText('Article submitted for review')).toBeInTheDocument();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Publish' }));
      await waitFor(() => {
        expect(publish).toHaveBeenCalledOnce();
      });
    });

    it('duplicates with a new title and no slug, then opens the copy', async () => {
      answer();
      let body: unknown;
      server.use(
        http.get(ONE, () => HttpResponse.json({ data: aContent() })),
        http.post(LIST, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ data: aContent({ id: ID.other }) }, { status: 201 });
        }),
      );
      const { user, router } = setup();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/content/articles/${ID.other}`);
      });
      expect(body).toEqual({ type: 'article', title: 'Copy of Q2 Report' });
    });

    it('asks before deleting, and offers Undo (03-DESIGN 15.1)', async () => {
      answer();
      const restore = vi.fn(() => HttpResponse.json({ data: aContent() }));
      server.use(
        http.delete(ONE, () => new HttpResponse(null, { status: 204 })),
        http.post(`${ONE}/restore`, restore),
      );
      const { user } = setup();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Delete this article?' }));
      expect(dialog.getByText(/permanently deleted after 30 days/)).toBeInTheDocument();
      await user.click(dialog.getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Article moved to trash')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(await screen.findByText('Article restored')).toBeInTheDocument();
      expect(restore).toHaveBeenCalledOnce();
    });

    it('asks before unpublishing, and offers Undo', async () => {
      answer([aListRow({ status: 'published' })]);
      const undo = vi.fn(() => HttpResponse.json({ data: aContent({ status: 'published' }) }));
      server.use(
        http.post(`${ONE}/unpublish`, () =>
          HttpResponse.json({ data: aContent({ status: 'unpublished' }) }),
        ),
        http.post(`${ONE}/unpublish/undo`, undo),
      );
      const { user } = setup();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Unpublish' }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Unpublish' }),
      );

      expect(await screen.findByText('Article unpublished')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(await screen.findByText('Article published again')).toBeInTheDocument();
    });

    it('asks before archiving, and can be cancelled', async () => {
      answer([aListRow({ status: 'unpublished' })]);
      const archive = vi.fn(() => HttpResponse.json({ data: aContent({ status: 'archived' }) }));
      server.use(http.post(`${ONE}/archive`, archive));
      const { user } = setup();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(archive).not.toHaveBeenCalled();

      await openMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));

      expect(await screen.findByText('Article archived')).toBeInTheDocument();
    });
  });
});
