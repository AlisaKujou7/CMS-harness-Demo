import { MutationCache, QueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../stores/session.store';
import { globalErrors$ } from '../streams/global-errors.stream';
import { hasStatus, isRetryable } from './api-error';

const STALE_MS = 30_000;

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      // The caller shows this failure itself, such as next to a form field.
      readonly handlesErrors?: boolean;
    };
  }
}

export function shouldRetryQuery(failures: number, error: unknown): boolean {
  return failures < 1 && isRetryable(error);
}

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        retryDelay: 0,
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.handlesErrors !== true && !hasStatus(error, 401)) {
          globalErrors$.next(error);
        }
      },
    }),
  });
  // Keys do not name the user, so the next person to sign in here must not see this one's data.
  useSessionStore.subscribe((session, previous) => {
    if (previous.status === 'authenticated' && session.status !== 'authenticated') client.clear();
  });
  return client;
}
