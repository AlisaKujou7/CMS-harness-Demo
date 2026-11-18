import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPreference, writePreference } from './preferences';

describe('preferences', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('remembers a value under its own namespace', () => {
    writePreference('theme', 'dark');

    expect(readPreference('theme')).toBe('dark');
    expect(window.localStorage.getItem('cms.theme')).toBe('dark');
  });

  it('answers null for what was never stored', () => {
    expect(readPreference('missing')).toBeNull();
  });

  it('survives storage being blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readPreference('theme')).toBeNull();
    expect(() => {
      writePreference('theme', 'dark');
    }).not.toThrow();
  });
});
