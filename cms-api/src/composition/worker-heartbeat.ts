import { statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A worker whose event loop is stuck, or whose queues have stopped, still looks like a running
// process. It proves otherwise by touching this file, and the container's health check reads it.
export const HEARTBEAT_PATH = join(tmpdir(), 'cms-worker-heartbeat');
export const HEARTBEAT_INTERVAL_MS = 10_000;
// Three missed beats, so one slow image job cannot make the worker look unhealthy.
export const HEARTBEAT_MAX_AGE_MS = 3 * HEARTBEAT_INTERVAL_MS;

export function startHeartbeat(
  path: string,
  intervalMs: number,
  isAlive: () => boolean,
): () => void {
  const beat = () => {
    try {
      if (isAlive()) writeFileSync(path, '');
    } catch {
      // A beat that cannot be written goes stale and reads as unhealthy. It must not end the worker.
    }
  };
  beat();
  const timer = setInterval(beat, intervalMs);
  return () => {
    clearInterval(timer);
  };
}

export function isHeartbeatFresh(path: string, maxAgeMs: number, nowMs: number): boolean {
  try {
    return nowMs - statSync(path).mtimeMs <= maxAgeMs;
  } catch {
    return false;
  }
}
