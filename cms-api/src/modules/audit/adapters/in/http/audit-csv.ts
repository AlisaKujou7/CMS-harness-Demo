import type { AuditEventView } from '../../../application/ports/out/audit-reader.port.js';

const LINE_END = '\r\n';
const FORMULA_START = /^[=+\-@\t\r]/;

export const CSV_HEADER = `id,occurred_at,actor_id,actor_ip,action,target_type,target_id,summary${LINE_END}`;

// Prefixes values a spreadsheet would run as a formula, since audit data can hold user input.
function csvField(value: string | null): string {
  if (value === null) return '';
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsvRow(event: AuditEventView): string {
  const fields = [
    event.id,
    event.occurredAt.toISOString(),
    event.actorId,
    event.actorIp,
    event.action,
    event.targetType,
    event.targetId,
    JSON.stringify(event.summary),
  ];
  return fields.map(csvField).join(',') + LINE_END;
}
