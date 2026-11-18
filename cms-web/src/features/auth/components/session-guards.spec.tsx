import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { anAdmin, Providers, signIn } from '../../../../test/utils/render-with-providers';
import { useSessionStore } from '../../../shared/stores/session.store';
import { IDLE_EXPIRE_MS, IDLE_WARN_MS, IdleSessionContainer } from './IdleSessionContainer';
import { PrivacyNoticeContainer } from './PrivacyNoticeContainer';

const inProviders = (element: React.ReactElement) => render(<Providers>{element}</Providers>);

describe('PrivacyNoticeContainer (02-SRS 10.1)', () => {
  it('shows on first login, and not again once accepted', async () => {
    signIn();
    const first = inProviders(<PrivacyNoticeContainer />);

    await expectNoA11yViolations();
    await userEvent.click(screen.getByRole('button', { name: 'I understand' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    first.unmount();

    inProviders(<PrivacyNoticeContainer />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('treats closing it as having seen it', async () => {
    signIn();
    inProviders(<PrivacyNoticeContainer />);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(window.localStorage.getItem(`cms.privacy-notice.${anAdmin.id}`)).not.toBeNull();
  });

  it('asks each user on a shared browser', () => {
    window.localStorage.setItem('cms.privacy-notice.someone-else', 'seen');
    signIn();
    inProviders(<PrivacyNoticeContainer />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('IdleSessionContainer (SEC-12)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const logoutCalled = () => {
    const called = vi.fn();
    server.use(
      http.post('*/api/admin/auth/logout', () => {
        called();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    return called;
  };

  it('warns before the session ends, and any activity keeps it', () => {
    vi.useFakeTimers();
    signIn();
    inProviders(<IdleSessionContainer />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(IDLE_WARN_MS);
    });
    expect(screen.getByRole('dialog')).toHaveTextContent('Are you still there?');

    act(() => {
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new Event('keydown'));
    });
    act(() => {
      vi.advanceTimersByTime(IDLE_EXPIRE_MS - IDLE_WARN_MS);
    });
    expect(useSessionStore.getState().status).toBe('authenticated');
  });

  it('signs out after 30 minutes without activity', async () => {
    const logout = logoutCalled();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn();
    inProviders(<IdleSessionContainer />);

    act(() => {
      vi.advanceTimersByTime(IDLE_EXPIRE_MS);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(useSessionStore.getState().status).toBe('anonymous');
    });
    expect(logout).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/signed out after 30 minutes/);
  });

  it('lets the user sign out from the warning', async () => {
    const logout = logoutCalled();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn();
    inProviders(<IdleSessionContainer />);
    act(() => {
      vi.advanceTimersByTime(IDLE_WARN_MS);
    });
    vi.useRealTimers();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));
  });
});
