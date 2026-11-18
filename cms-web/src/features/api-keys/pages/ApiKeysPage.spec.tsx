import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anApiKey, ID } from '../../../../test/builders';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { renderPage, signIn } from '../../../../test/utils/render-with-providers';
import { ApiKeysPage } from './ApiKeysPage';

const KEYS = '*/api/admin/api-keys';

function answer(rows = [anApiKey()]) {
  server.use(http.get(KEYS, () => HttpResponse.json({ data: rows })));
}

function setup() {
  signIn();
  return renderPage(<ApiKeysPage />);
}

async function createKey(user: ReturnType<typeof renderPage>['user']) {
  await user.click(await screen.findByRole('button', { name: 'New Key' }));
  await user.type(screen.getByLabelText('Name'), 'Mobile App');
  await user.click(screen.getByRole('button', { name: 'Create key' }));
}

describe('ApiKeysPage (03-DESIGN 12.8)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists keys by prefix, last use and status', async () => {
    answer([
      anApiKey(),
      anApiKey({
        id: ID.media,
        name: 'Legacy',
        last_used_at: new Date().toISOString(),
        revoked_at: new Date().toISOString(),
      }),
    ]);
    setup();

    expect(await screen.findAllByText('cmsk_a1b2c3')).toHaveLength(2);
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke Legacy' })).not.toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('explains an empty list', async () => {
    answer([]);
    setup();

    expect(await screen.findByRole('heading', { name: 'No API keys yet' })).toBeInTheDocument();
  });

  it('shows a new key once, with a warning and a copy button', async () => {
    answer();
    const writeText = vi.fn().mockResolvedValue(undefined);
    let body: unknown;
    server.use(
      http.post(KEYS, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...anApiKey(), key: 'cmsk_secret' } }, { status: 201 });
      }),
    );
    const { user } = setup();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    await createKey(user);

    const dialog = within(await screen.findByRole('dialog', { name: 'Your new API key' }));
    expect(body).toEqual({ name: 'Mobile App' });
    expect(dialog.getByRole('status')).toHaveTextContent(
      'You will not be able to view this key again',
    );
    expect(dialog.getByRole('textbox')).toHaveValue('cmsk_secret');

    await user.click(dialog.getByRole('button', { name: 'Copy key' }));
    expect(writeText).toHaveBeenCalledWith('cmsk_secret');
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByText('cmsk_secret')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('says so when the copy fails', async () => {
    answer();
    server.use(
      http.post(KEYS, () =>
        HttpResponse.json({ data: { ...anApiKey(), key: 'k' } }, { status: 201 }),
      ),
    );
    const { user } = setup();
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
    });

    await createKey(user);
    await user.click(await screen.findByRole('button', { name: 'Copy key' }));

    expect(await screen.findByText("Couldn't copy to clipboard")).toBeInTheDocument();
  });

  it('needs a name, shows a refusal, and can be cancelled', async () => {
    answer();
    server.use(
      http.post(KEYS, () =>
        HttpResponse.json({ error: { code: 'X', message: 'Name is too long' } }, { status: 422 }),
      ),
    );
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'New Key' }));
    await user.click(screen.getByRole('button', { name: 'Create key' }));
    expect(await screen.findByText('Give the key a name')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'x');
    await user.click(screen.getByRole('button', { name: 'Create key' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is too long');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('asks for the name before revoking (03-DESIGN 13.5)', async () => {
    answer();
    const revoke = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.delete(`${KEYS}/${ID.other}`, revoke));
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Revoke Production Web' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Revoke' })).toBeDisabled();

    await user.type(dialog.getByLabelText('Key name'), 'Production Web');
    await user.click(dialog.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Key revoked')).toBeInTheDocument();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('can back out of revoking', async () => {
    answer();
    const { user } = setup();

    await user.click(await screen.findByRole('button', { name: 'Revoke Production Web' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
