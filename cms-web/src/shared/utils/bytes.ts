const KB = 1024;
const UNITS = ['KB', 'MB', 'GB'] as const;

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${String(bytes)} B`;
  let value = bytes / KB;
  let unit = 0;
  while (value >= KB && unit < UNITS.length - 1) {
    value /= KB;
    unit += 1;
  }
  return `${value.toFixed(1)} ${String(UNITS[unit])}`;
}
