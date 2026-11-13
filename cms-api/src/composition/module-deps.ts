import type { ContentDeps } from '../modules/content/application/content-deps.js';
import { CountMediaUsage } from '../modules/content/application/use-cases/read-content.use-case.js';
import type { MediaDeps } from '../modules/media/application/media-deps.js';
import {
  GetMediaViews,
  InspectImageReferences,
} from '../modules/media/application/use-cases/read-media.use-case.js';
import type { PublicApiDeps } from '../modules/public-api/application/public-api-deps.js';
import { InvalidatePublicCache } from '../modules/public-api/application/use-cases/read-public-item.use-case.js';
import { ReadPublishedContent } from '../modules/content/application/use-cases/read-published-content.use-case.js';
import type { InProcessEventPublisher } from '../shared/adapters/out/in-process-event-publisher.js';

export function publicApiDeps(
  infrastructure: Omit<ContentDeps, 'mediaCatalog'> &
    Omit<MediaDeps, 'usage'> &
    Pick<PublicApiDeps, 'responseCache' | 'publicApiConfig'>,
): PublicApiDeps {
  const mediaViews = new GetMediaViews(infrastructure);
  return {
    content: new ReadPublishedContent(infrastructure),
    mediaReader: { findByIds: (ids) => mediaViews.execute(ids) },
    responseCache: infrastructure.responseCache,
    clock: infrastructure.clock,
    publicApiConfig: infrastructure.publicApiConfig,
  };
}

// Content leaving or joining the public set should not wait for the cache to expire. The worker
// needs this too, because it is what publishes on schedule.
export function wirePublicCacheInvalidation(
  infrastructure: Pick<PublicApiDeps, 'responseCache'> & {
    readonly events: InProcessEventPublisher;
  },
): void {
  const invalidate = new InvalidatePublicCache(infrastructure);
  const types = ['ContentPublished', 'ContentUnpublished', 'ContentDeleted', 'MediaDeleted'];
  for (const type of types) {
    infrastructure.events.subscribe(type, () => invalidate.execute());
  }
}

// Content and media each need one answer from the other. They ask through a port of their own, and
// this is the only place that knows the two ends meet (04-ARCH 4.7).
export function contentDeps(
  infrastructure: Omit<ContentDeps, 'mediaCatalog'> & Pick<MediaDeps, 'media'>,
): ContentDeps {
  const inspect = new InspectImageReferences(infrastructure);
  return {
    ...infrastructure,
    mediaCatalog: { inspectImages: (ids) => inspect.execute(ids) },
  };
}

export function mediaDeps(
  infrastructure: Omit<MediaDeps, 'usage'> & Pick<ContentDeps, 'contents'>,
): MediaDeps {
  const countUsage = new CountMediaUsage(infrastructure);
  return {
    ...infrastructure,
    usage: { countUsage: (mediaId) => countUsage.execute(mediaId) },
  };
}
