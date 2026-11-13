// 04-ARCH 5.5.2: the only place that touches browser storage. Storage can be blocked or full, and
// a preference is never worth failing over.
export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(`cms.${key}`);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(`cms.${key}`, value);
  } catch {
    // The preference lasts until the next reload instead.
  }
}
