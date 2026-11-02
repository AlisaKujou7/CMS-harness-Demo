import type { ContentDeps } from '../modules/content/application/content-deps.js';
import { CountMediaUsage } from '../modules/content/application/use-cases/read-content.use-case.js';
import type { MediaDeps } from '../modules/media/application/media-deps.js';
import { InspectImageReferences } from '../modules/media/application/use-cases/read-media.use-case.js';

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
