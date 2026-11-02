import { describe, expect, it } from 'vitest';
import { aContent, aTextBody } from '../../test/builders/a-content.js';
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

  it('purges expired tokens', async () => {
    await expect(job('purge-expired-tokens').run()).resolves.toBe(0);
  });
});
