import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isHeartbeatFresh, startHeartbeat } from './worker-heartbeat.js';

describe('worker heartbeat', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'heartbeat-'));
    path = join(dir, 'beat');
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true });
  });

  it('beats at once, so the worker is healthy as soon as it has started', () => {
    const stop = startHeartbeat(path, 1000, () => true);
    stop();

    expect(isHeartbeatFresh(path, 1000, Date.now())).toBe(true);
  });

  it('does not beat while the queues are stopped', () => {
    const stop = startHeartbeat(path, 1000, () => false);
    stop();

    expect(isHeartbeatFresh(path, 1000, Date.now())).toBe(false);
  });

  it('keeps beating every interval until stopped', () => {
    vi.useFakeTimers();
    let beats = 0;
    const stop = startHeartbeat(path, 1000, () => {
      beats += 1;
      return true;
    });

    vi.advanceTimersByTime(2000);
    stop();
    vi.advanceTimersByTime(2000);

    expect(beats).toBe(3);
  });

  it('survives a beat it cannot write, which then reads as stale', () => {
    const unwritable = join(dir, 'missing-directory', 'beat');

    const stop = startHeartbeat(unwritable, 1000, () => true);
    stop();

    expect(isHeartbeatFresh(unwritable, 1000, Date.now())).toBe(false);
  });

  it('reads an old beat as stale, and one exactly at the limit as fresh', () => {
    writeFileSync(path, '');
    const beatAt = new Date('2026-01-01T00:00:00.000Z');
    utimesSync(path, beatAt, beatAt);

    expect(isHeartbeatFresh(path, 1000, beatAt.getTime() + 1000)).toBe(true);
    expect(isHeartbeatFresh(path, 1000, beatAt.getTime() + 1001)).toBe(false);
  });

  it('reads a missing file as stale', () => {
    expect(isHeartbeatFresh(path, 1000, Date.now())).toBe(false);
  });
});
