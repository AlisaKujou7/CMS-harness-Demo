import type { AuditQuery } from '../../shared/api/types';

const FILTERS = ['actor_id', 'action', 'target_type'] as const;

function dayStart(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

function dayEnd(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

// The date inputs are whole local days, and the API expects instants (NFR-I18N-02).
export function toAuditFilter(params: URLSearchParams): Omit<AuditQuery, 'page' | 'page_size'> {
  const from = params.get('from');
  const to = params.get('to');
  const chosen = Object.fromEntries(
    FILTERS.flatMap((name) => {
      const value = params.get(name);
      return value === null ? [] : [[name, value]];
    }),
  );
  return {
    ...chosen,
    ...(from === null ? {} : { from: dayStart(from) }),
    ...(to === null ? {} : { to: dayEnd(to) }),
  };
}

const SUMMARY_PREVIEW = 60;

export function summaryText(summary: unknown): string {
  const isEmpty =
    summary === null ||
    summary === undefined ||
    (typeof summary === 'object' && Object.keys(summary).length === 0);
  return isEmpty ? '' : JSON.stringify(summary);
}

export function isLongSummary(text: string): boolean {
  return text.length > SUMMARY_PREVIEW;
}

export function previewOf(text: string): string {
  return isLongSummary(text) ? `${text.slice(0, SUMMARY_PREVIEW)}…` : text;
}
