import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PresignedUpload } from '../api/types';
import { putFile } from './upload-transport';

class FakeXhr {
  static last: FakeXhr;
  status = 0;
  statusText = '';
  readonly upload: { onprogress?: (event: Partial<ProgressEvent>) => void } = {};
  readonly headers: Record<string, string> = {};
  onload?: () => void;
  onerror?: () => void;
  method = '';
  url = '';
  sent: unknown;
  readonly abort = vi.fn();

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  send(body: unknown): void {
    this.sent = body;
  }
}

const upload: PresignedUpload = {
  upload_url: 'https://storage.example.com/key',
  storage_key: 'key',
  expires_in: 900,
  headers: { 'Content-Type': 'image/png' },
};
const file = new File(['x'], 'a.png', { type: 'image/png' });

function start() {
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  const seen: number[] = [];
  const outcome = { completed: false, error: null as unknown };
  const subscription = putFile(upload, file).subscribe({
    next: (value) => seen.push(value),
    complete: () => {
      outcome.completed = true;
    },
    error: (error: unknown) => {
      outcome.error = error;
    },
  });
  return { seen, outcome, subscription, xhr: FakeXhr.last };
}

describe('putFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the file to the presigned URL with its signed headers', () => {
    const { xhr } = start();

    expect(xhr).toMatchObject({
      method: 'PUT',
      url: upload.upload_url,
      headers: upload.headers,
      sent: file,
    });
  });

  it('reports progress and finishes at 1', () => {
    const { xhr, seen, outcome } = start();

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 2, total: 0 });
    xhr.status = 204;
    xhr.onload?.();

    expect(seen).toEqual([0.25, 1]);
    expect(outcome.completed).toBe(true);
  });

  it.each([199, 300, 403])('fails on a status of %i', (status) => {
    const { xhr, outcome } = start();

    xhr.status = status;
    xhr.statusText = 'Refused';
    xhr.onload?.();

    expect(outcome.error).toMatchObject({ status, code: 'UPLOAD_FAILED', message: 'Refused' });
  });

  it('accepts the top of the success range', () => {
    const { xhr, outcome } = start();

    xhr.status = 299;
    xhr.onload?.();

    expect(outcome.completed).toBe(true);
  });

  it('fails when storage cannot be reached', () => {
    const { xhr, outcome } = start();

    xhr.onerror?.();

    expect(outcome.error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('aborts when no longer wanted', () => {
    const { xhr, subscription } = start();

    subscription.unsubscribe();

    expect(xhr.abort).toHaveBeenCalledOnce();
  });
});
