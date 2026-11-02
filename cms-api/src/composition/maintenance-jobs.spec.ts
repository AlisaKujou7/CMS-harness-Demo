import { describe, expect, it } from 'vitest';
import { aContent, aTextBody } from '../../test/builders/a-content.js';
import { aMediaItem } from '../../test/builders/a-media-item.js';
import { createFakeInfrastructure } from '../../test/builders/http-app.js';
import { createMaintenanceJobs } from './maintenance-jobs.js';

describe('createMaintenanceJobs', () => {
  const jobs = (infra = createFakeInfrastructure()) => createMaintenanceJobs(infra, 30_000);
  const job = (name: string, infra = createFakeInfrastructure()) => {
    const found = jobs(infra).find((candidate) => candidate.name === name);
    if (!found) throw new Error(`No job ${name}`);
    return found;
  };

  it('schedules publishing at the configured interval and purges daily', () => {
    const everyMs = Object.fromEntries(jobs().map(({ name, everyMs }) => [name, everyMs]));

    expect(everyMs).toEqual({
      'publish-due-content': 30_000,
      'purge-deleted-content': 86_400_000,
      'purge-expired-tokens': 86_400_000,
      'requeue-media-variants': 300_000,
      'purge-abandoned-uploads': 86_400_000,
      'purge-deleted-media-files': 300_000,
    });
  });

  it('publishes what is due', async () => {
    const infra = createFakeInfrastructure();
    infra.contents.add(aContent({ body: aTextBody('x'), scheduledAt: new Date(0) }));

    await expect(job('publish-due-content', infra).run()).resolves.toBe(1);
  });

  it('purges old deleted content', async () => {
    const infra = createFakeInfrastructure();
    infra.contents.add(aContent({ deletedAt: new Date(0) }));

    await expect(job('purge-deleted-content', infra).run()).resolves.toBe(1);
  });

  it('asks again for variants that have waited too long', async () => {
    const infra = createFakeInfrastructure();
    infra.media.add(aMediaItem({ createdAt: new Date(infra.clock.now().getTime() - 3 * 60_000) }));

    await expect(job('requeue-media-variants', infra).run()).resolves.toBe(1);
  });

  it('finishes file deletions that storage could not do at the time', async () => {
    await expect(job('purge-deleted-media-files').run()).resolves.toBe(0);
  });

  it('purges abandoned uploads', async () => {
    await expect(job('purge-abandoned-uploads').run()).resolves.toBe(0);
  });

  it('purges expired tokens', async () => {
    await expect(job('purge-expired-tokens').run()).resolves.toBe(0);
  });
});
