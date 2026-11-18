import { createServer, get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditEventView } from '../../../application/ports/out/audit-reader.port.js';
import { streamCsv } from './audit-csv.js';

const row: AuditEventView = {
  id: 'e1',
  occurredAt: new Date('2026-05-11T10:00:00.000Z'),
  actorId: null,
  actorIp: null,
  action: 'x'.repeat(4096),
  targetType: null,
  targetId: null,
  summary: {},
};

describe('streamCsv', () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.closeAllConnections();
    server?.close();
  });

  const serve = (events: AsyncIterable<AuditEventView>) =>
    new Promise<{ url: string; finished: Promise<unknown> }>((resolve) => {
      let settle: (value: unknown) => void;
      const finished = new Promise((done) => {
        settle = done;
      });
      server = createServer((_request, response) => {
        void streamCsv(events, response).then(settle, settle);
      });
      server.listen(0, '127.0.0.1', () => {
        const { port } = (server as Server).address() as AddressInfo;
        resolve({ url: `http://127.0.0.1:${String(port)}/`, finished });
      });
    });

  it('stops reading and finishes when the client disconnects mid download', async () => {
    let generatorClosed = false;
    async function* endless(): AsyncGenerator<AuditEventView> {
      try {
        for (;;) {
          await Promise.resolve();
          yield row;
        }
      } finally {
        generatorClosed = true;
      }
    }
    const { url, finished } = await serve(endless());

    const request = get(url, (response) => {
      response.once('data', () => {
        request.destroy();
      });
    });
    request.on('error', () => undefined);

    await finished;
    await vi.waitFor(() => {
      expect(generatorClosed).toBe(true);
    });
  });

  it('writes the header and every row, then ends', async () => {
    async function* one(): AsyncGenerator<AuditEventView> {
      await Promise.resolve();
      yield { ...row, action: 'done' };
    }
    const { url, finished } = await serve(one());

    const body = await (await fetch(url)).text();
    await finished;

    expect(body.split('\r\n')[0]).toContain('id,occurred_at');
    expect(body).toContain(',done,');
  });
});
