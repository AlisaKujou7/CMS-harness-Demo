import { create } from 'zustand';
import { readPreference, writePreference } from '../persistence/preferences';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ToastSeverity = 'info' | 'success' | 'error';

export interface ToastAction {
  readonly label: string;
  run(): void;
}

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly severity: ToastSeverity;
  readonly action?: ToastAction;
  // Null stays until dismissed.
  readonly durationMs: number | null;
}

interface UiState {
  readonly themeMode: ThemeMode;
  readonly drawerOpen: boolean;
  readonly toasts: readonly Toast[];
  setThemeMode(mode: ThemeMode): void;
  setDrawerOpen(open: boolean): void;
  pushToast(toast: Omit<Toast, 'id'>): number;
  dismissToast(id: number): void;
}

const THEME_KEY = 'theme';

export function parseThemeMode(value: string | null): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}

let nextToastId = 1;

export const useUiStore = create<UiState>((set) => ({
  themeMode: parseThemeMode(readPreference(THEME_KEY)),
  drawerOpen: false,
  toasts: [],
  setThemeMode: (themeMode) => {
    writePreference(THEME_KEY, themeMode);
    set({ themeMode });
  },
  setDrawerOpen: (drawerOpen) => {
    set({ drawerOpen });
  },
  pushToast: (toast) => {
    const id = nextToastId;
    nextToastId += 1;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

// 03-DESIGN 10.9: 4 s by default and 6 s with an action.
const DEFAULT_MS = 4000;
const WITH_ACTION_MS = 6000;

function toast(severity: ToastSeverity, message: string, action?: ToastAction): number {
  return useUiStore.getState().pushToast({
    message,
    severity,
    durationMs: action ? WITH_ACTION_MS : DEFAULT_MS,
    ...(action ? { action } : {}),
  });
}

export const notify = {
  info: (message: string, action?: ToastAction) => toast('info', message, action),
  success: (message: string, action?: ToastAction) => toast('success', message, action),
  error: (message: string, action?: ToastAction) => toast('error', message, action),
};
