import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { useSessionStore } from '../src/shared/stores/session.store';
import { useUiStore } from '../src/shared/stores/ui.store';
import { server } from './mocks/server';

// jsdom has no layout, and MUI and ProseMirror ask for it.
function stubLayout(): void {
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Element.prototype.scrollIntoView = vi.fn();
  document.elementFromPoint = () => null;
}

// The editor loads on demand, and that first import can take a while on a busy machine.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  stubLayout();
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.localStorage.clear();
  useSessionStore.setState({ status: 'loading', accessToken: null, user: null });
  useUiStore.setState({ toasts: [], drawerOpen: false, themeMode: 'system' });
});

afterAll(() => {
  server.close();
});
