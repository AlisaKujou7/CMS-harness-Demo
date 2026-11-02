import { PurgeExpiredTokens } from '../modules/auth/application/use-cases/purge-expired-tokens.use-case.js';
import { PublishDueContent } from '../modules/content/application/use-cases/publish-due-content.use-case.js';
import { PurgeDeletedContent } from '../modules/content/application/use-cases/purge-deleted-content.use-case.js';
import {
  EnqueueMissingVariants,
  PurgeAbandonedUploads,
} from '../modules/media/application/use-cases/media-background.use-case.js';
import { contentDeps, mediaDeps } from './module-deps.js';
import type { MaintenanceJob } from '../shared/adapters/out/bullmq-maintenance.js';
import type { Infrastructure } from './app.module.js';

const DAY_MS = 86_400_000;
const FIVE_MINUTES_MS = 5 * 60_000;

export function createMaintenanceJobs(
  infrastructure: Infrastructure,
  scheduledPublishIntervalMs: number,
): readonly MaintenanceJob[] {
  const publishDue = new PublishDueContent(contentDeps(infrastructure));
  const purgeDeleted = new PurgeDeletedContent(contentDeps(infrastructure));
  const requeueVariants = new EnqueueMissingVariants(mediaDeps(infrastructure));
  const purgeUploads = new PurgeAbandonedUploads(mediaDeps(infrastructure));
  const purgeTokens = new PurgeExpiredTokens(infrastructure);
  return [
    {
      name: 'publish-due-content',
      everyMs: scheduledPublishIntervalMs,
      run: () => publishDue.execute(),
    },
    { name: 'purge-deleted-content', everyMs: DAY_MS, run: () => purgeDeleted.execute() },
    {
      name: 'requeue-media-variants',
      everyMs: FIVE_MINUTES_MS,
      run: () => requeueVariants.execute(),
    },
    { name: 'purge-abandoned-uploads', everyMs: DAY_MS, run: () => purgeUploads.execute() },
    { name: 'purge-expired-tokens', everyMs: DAY_MS, run: () => purgeTokens.execute() },
  ];
}
