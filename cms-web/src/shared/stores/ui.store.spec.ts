import { describe, expect, it } from 'vitest';
import { notify, parseThemeMode, useUiStore } from './ui.store';

const toasts = () => useUiStore.getState().toasts;

describe('ui store', () => {
  it('keeps the theme choice for the next visit', () => {
    useUiStore.getState().setThemeMode('dark');

    expect(useUiStore.getState().themeMode).toBe('dark');
    expect(window.localStorage.getItem('cms.theme')).toBe('dark');
  });

  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'system'],
    ['purple', 'system'],
    [null, 'system'],
  ])('reads a stored theme of %s as %s', (stored, expected) => {
    expect(parseThemeMode(stored)).toBe(expected);
  });

  it('opens and closes the drawer', () => {
    useUiStore.getState().setDrawerOpen(true);
    expect(useUiStore.getState().drawerOpen).toBe(true);

    useUiStore.getState().setDrawerOpen(false);
    expect(useUiStore.getState().drawerOpen).toBe(false);
  });

  it('shows a toast for 4 seconds, or 6 with an action (03-DESIGN 10.9)', () => {
    notify.success('Saved');
    notify.info('Moved', { label: 'Undo', run: () => undefined });
    notify.error('Failed');

    expect(
      toasts().map(({ message, severity, durationMs }) => [message, severity, durationMs]),
    ).toEqual([
      ['Saved', 'success', 4000],
      ['Moved', 'info', 6000],
      ['Failed', 'error', 4000],
    ]);
    expect(toasts()[1]?.action?.label).toBe('Undo');
    expect(toasts()[0]).not.toHaveProperty('action');
  });

  it('gives each toast its own id and removes only the one dismissed', () => {
    const first = notify.info('One');
    const second = notify.info('Two');

    expect(second).not.toBe(first);
    useUiStore.getState().dismissToast(first);

    expect(toasts().map((toast) => toast.id)).toEqual([second]);
  });
});
