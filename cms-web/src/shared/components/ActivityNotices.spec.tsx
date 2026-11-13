import { useMutation } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '../../../test/utils/render-with-providers';
import { OfflineNotice, StillWorkingNotice } from './ActivityNotices';

function SlowAction() {
  const { mutate } = useMutation({ mutationFn: () => new Promise(() => undefined) });
  useEffect(() => {
    mutate();
  }, [mutate]);
  return <StillWorkingNotice />;
}

describe('OfflineNotice', () => {
  it('shows while offline', () => {
    render(<OfflineNotice />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/offline/);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
  });
});

describe('StillWorkingNotice', () => {
  it('says so once an action passes 2 seconds', () => {
    vi.useFakeTimers();
    render(
      <Providers>
        <SlowAction />
      </Providers>,
    );
    expect(screen.queryByText('Still working...')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Still working...')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
