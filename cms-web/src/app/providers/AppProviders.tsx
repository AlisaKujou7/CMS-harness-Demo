import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo } from 'react';
import { createCmsTheme } from '../../design-system/theme/create-theme';
import { createQueryClient } from '../../shared/api/query-client';
import { refreshSession } from '../../shared/api/session-fetch';
import { ToastHost } from '../../shared/components/ToastHost';
import { useSubscription } from '../../shared/hooks/useSubscription';
import { notify, useUiStore } from '../../shared/stores/ui.store';
import { errorToMessage, globalErrors$ } from '../../shared/streams/global-errors.stream';

const queryClient = createQueryClient();

function showGlobalError(error: unknown): void {
  notify.error(errorToMessage(error));
}

function useResolvedTheme() {
  const mode = useUiStore((state) => state.themeMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  return useMemo(() => createCmsTheme(dark ? 'dark' : 'light'), [dark]);
}

export function AppProviders({ children }: { readonly children: ReactNode }) {
  const theme = useResolvedTheme();
  // A reload loses the in-memory access token, and the refresh cookie brings it back.
  useEffect(() => {
    void refreshSession();
  }, []);
  useSubscription(globalErrors$, showGlobalError);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastHost />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
