import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anAuditEvent, aPage, aUser, ID } from '../../../../test/builders';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { renderPage, signIn } from '../../../../test/utils/render-with-providers';
import * as download from '../../../shared/browser/download';
import { AuditPage } from './AuditPage';

const AUDIT = '*/api/admin/audit';

function answer(rows = [anAuditEvent()]) {
  const urls: URL[] = [];
  server.use(
    http.get('*/api/admin/users', () =>
      HttpResponse.json({ data: [aUser()], pagination: aPage() }),
    ),
    http.get(AUDIT, ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({ data: rows, pagination: aPage({ total_pages: 2 }) });
    }),
  );
  return urls;
}

function setup(route = '/audit') {
  signIn();
  return renderPage(<AuditPage />, { route });
}

describe('AuditPage (FR-AUDIT-05, 06)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows who did what, offers no way to change it', async () => {
    answer();
    setup();

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('content.publish')).toBeInTheDocument();
    expect(screen.getByText(`content ${ID.content}`)).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete|edit/i })).not.toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('copes with an event that has no target or actor', async () => {
    answer([anAuditEvent({ target_type: null, target_id: null, actor_id: null })]);
    setup();

    expect(await screen.findByText('System')).toBeInTheDocument();
  });

  it('expands a long summary', async () => {
    const summary = { note: 'x'.repeat(100) };
    answer([anAuditEvent({ summary })]);
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Show more' }));
    expect(screen.getByText(JSON.stringify(summary))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText(JSON.stringify(summary))).not.toBeInTheDocument();
  });

  it('shows a short summary in full, without a toggle', async () => {
    answer([anAuditEvent({ summary: { a: 1 } })]);
    setup();

    expect(await screen.findByText('{"a":1}')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('filters by actor, action, target and date, through the URL', async () => {
    const urls = answer();
    const { user, router } = setup();
    await screen.findByText('Alice');

    await user.click(screen.getByRole('combobox', { name: 'Actor' }));
    await user.click(screen.getByRole('option', { name: 'Alice' }));
    await user.click(screen.getByRole('combobox', { name: 'Action' }));
    await user.click(screen.getByRole('option', { name: 'content.publish' }));
    await user.click(screen.getByRole('combobox', { name: 'Target type' }));
    await user.click(screen.getByRole('option', { name: 'Media' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-05-02' } });

    await waitFor(() => {
      const last = urls.at(-1)?.searchParams;
      expect(last?.get('actor_id')).toBe(ID.user);
      expect(last?.get('action')).toBe('content.publish');
      expect(last?.get('target_type')).toBe('media');
      expect(last?.get('from')).toBe(new Date(2026, 4, 1).toISOString());
      expect(last?.get('to')).toBe(new Date(2026, 4, 2, 23, 59, 59, 999).toISOString());
    });
    expect(router.state.location.search).toContain('target_type=media');
  });

  it('pages through events', async () => {
    const urls = answer();
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(urls.at(-1)?.searchParams.get('page')).toBe('2');
    });
  });

  it('offers to clear filters that match nothing', async () => {
    answer([]);
    const { user, router } = setup('/audit?action=content.publish&from=2026-05-01');

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.search).toBe('');
  });

  it('exports what the filters show as CSV', async () => {
    answer();
    let exported: URL | undefined;
    server.use(
      http.get(`${AUDIT}/export.csv`, ({ request }) => {
        exported = new URL(request.url);
        return new HttpResponse('a,b', { headers: { 'Content-Type': 'text/csv' } });
      }),
    );
    const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => undefined);
    const { user } = setup('/audit?action=content.publish');

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(expect.any(Blob), 'audit-log.csv');
    });
    expect(exported?.searchParams.get('action')).toBe('content.publish');
  });
});
