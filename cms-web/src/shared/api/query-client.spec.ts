import { describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '../stores/session.store';
import { globalErrors$ } from '../streams/global-errors.stream';
import { ApiError } from './api-error';
import { createQueryClient, shouldRetryQuery } from './query-client';

const anError = (status: number) => new ApiError({ status, code: 'X', message: 'm' });

async function runFailingMutation(error: unknown, meta?: { handlesErrors: boolean }) {
  const seen = vi.fn();
  const subscription = globalErrors$.subscribe(seen);
  const client = createQueryClient();
  const mutation = client.getMutationCache().build(client, {
    mutationFn: () => Promise.reject(error as Error),
    ...(meta ? { meta } : {}),
  });
  await mutation.execute(undefined).catch(() => undefined);
  subscription.unsubscribe();
  return seen;
}

describe('createQueryClient', () => {
  it('forgets everything when a session ends, however it ends', () => {
    const client = createQueryClient();
    client.setQueryData(['content', 'list'], 'rows of the previous user');
    useSessionStore.setState({ status: 'authenticated' });
    expect(client.getQueryData(['content', 'list'])).toBeDefined();

    useSessionStore.getState().end();

    expect(client.getQueryData(['content', 'list'])).toBeUndefined();
  });

  it('keeps what it has when a session merely starts', () => {
    const client = createQueryClient();
    useSessionStore.setState({ status: 'loading' });
    client.setQueryData(['content', 'list'], 'rows');

    useSessionStore.setState({ status: 'anonymous' });

    expect(client.getQueryData(['content', 'list'])).toBe('rows');
  });

  it('retries a query once, and only for what might recover', () => {
    expect(shouldRetryQuery(0, anError(500))).toBe(true);
    expect(shouldRetryQuery(1, anError(500))).toBe(false);
    expect(shouldRetryQuery(0, anError(404))).toBe(false);
  });

  it('reports a failed mutation as a global error', async () => {
    const error = anError(500);

    expect(await runFailingMutation(error)).toHaveBeenCalledWith(error);
  });

  it('leaves a failure to a caller that handles it', async () => {
    expect(await runFailingMutation(anError(422), { handlesErrors: true })).not.toHaveBeenCalled();
  });

  it('reports a failure when the caller says it does not handle it', async () => {
    expect(await runFailingMutation(anError(422), { handlesErrors: false })).toHaveBeenCalled();
  });

  it('leaves a 401 to the session', async () => {
    expect(await runFailingMutation(anError(401))).not.toHaveBeenCalled();
  });
});
