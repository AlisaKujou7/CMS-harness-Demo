import { Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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

async function* toCsv(events: AsyncIterable<AuditEventView>): AsyncGenerator<string> {
  yield CSV_HEADER;
  for await (const event of events) yield toCsvRow(event);
}

// pipeline handles backpressure, stops reading when the client leaves, and aborts the response if
// reading fails, so a failed download cannot look like a complete file.
export async function streamCsv(
  events: AsyncIterable<AuditEventView>,
  response: Writable,
): Promise<void> {
  try {
    await pipeline(Readable.from(toCsv(events)), response);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') throw error;
  }
}
