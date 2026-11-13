import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { notify, useUiStore } from '../stores/ui.store';
import { ToastHost } from './ToastHost';

const toasts = () => useUiStore.getState().toasts;

describe('ToastHost', () => {
  it('shows nothing without a toast', () => {
    render(<ToastHost />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('announces success politely and errors at once', () => {
    render(<ToastHost />);

    act(() => {
      notify.success('Saved');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');

    act(() => {
      useUiStore.getState().dismissToast(toasts()[0]?.id ?? 0);
      notify.error('Failed');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('runs the action once and then dismisses', async () => {
    const run = vi.fn();
    render(<ToastHost />);
    act(() => {
      notify.info('Moved to trash', { label: 'Undo', run });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(run).toHaveBeenCalledOnce();
    expect(toasts()).toEqual([]);
  });

  it('can be closed, and then the next one shows', async () => {
    render(<ToastHost />);
    act(() => {
      notify.info('One');
      notify.info('Two');
    });
    expect(screen.getByText('One')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('dismisses itself when time is up, but not on a click elsewhere', () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => {
      notify.info('Short lived');
    });

    act(() => {
      document.body.click();
    });
    expect(screen.getByText('Short lived')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(toasts()).toEqual([]);
    vi.useRealTimers();
  });
});
