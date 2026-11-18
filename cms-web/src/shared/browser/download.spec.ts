import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveBlob } from './download';

describe('saveBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads the blob under the name given, and releases it', () => {
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: revoke }),
    );
    let saved = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      saved = `${this.download} ${this.href}`;
    });

    saveBlob(new Blob(['a,b']), 'log.csv');

    expect(saved).toBe('log.csv blob:x');
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
