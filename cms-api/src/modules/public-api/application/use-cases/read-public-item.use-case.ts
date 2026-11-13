import { AppError } from '../../../../shared/kernel/app-error.js';
import type {
  GetPublicMediaUseCase,
  GetPublishedContentUseCase,
  InvalidatePublicCacheUseCase,
  PublicContentDetail,
  PublicMedia,
  PublicResponse,
} from '../ports/in/public-api.ports.js';
import type { PublicContentType } from '../ports/out/public-sources.port.js';
import type { PublicApiDeps } from '../public-api-deps.js';
import {
  cached,
  contentTag,
  inlineMediaIds,
  mediaTag,
  resolveBody,
  toPublicMedia,
  toSummary,
} from '../services/public-helpers.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 200;

// One answer for missing and unpublished, so the API never confirms that a draft exists.
export class PublicItemNotFoundError extends AppError {
  constructor() {
    super({ kind: 'not_found', code: 'NOT_FOUND', message: 'Not found' });
  }
}

export class GetPublishedContent implements GetPublishedContentUseCase {
  constructor(private readonly deps: PublicApiDeps) {}

  execute(command: {
    readonly type: PublicContentType;
    readonly slug: string;
  }): Promise<PublicResponse<PublicContentDetail>> {
    const { type, slug } = command;
    if (slug.length > MAX_SLUG_LENGTH || !SLUG.test(slug)) {
      return Promise.reject(new PublicItemNotFoundError());
    }
    return cached(this.deps, `item:${type}:${slug}`, async () => {
      const record = await this.deps.content.findBySlug(type, slug);
      if (!record) throw new PublicItemNotFoundError();

      const ids = [
        ...new Set([
          ...(record.featuredImageId === null ? [] : [record.featuredImageId]),
          ...(record.socialImageId === null ? [] : [record.socialImageId]),
          ...inlineMediaIds(record.body),
        ]),
      ];
      const media = ids.length > 0 ? await this.deps.mediaReader.findByIds(ids) : [];
      const byId = new Map(media.map((item) => [item.id, item]));
      const imageOf = (id: string | null): PublicMedia | null => {
        const found = id === null ? undefined : byId.get(id);
        return found ? toPublicMedia(found) : null;
      };
      return {
        data: {
          ...toSummary(record, imageOf(record.featuredImageId)),
          body: resolveBody(record.body, byId),
          seo: { ...record.effectiveSeo, socialImage: imageOf(record.socialImageId) },
        },
        cacheTag: [contentTag(record), mediaTag(this.deps, media)].join('|'),
        lastModified: record.updatedAt.toUTCString(),
      };
    });
  }
}

// Only media that published content uses is public. Anything else may belong to a draft (RK-04).
export class GetPublicMedia implements GetPublicMediaUseCase {
  constructor(private readonly deps: PublicApiDeps) {}

  execute(command: { readonly id: string }): Promise<PublicResponse<PublicMedia>> {
    const { id } = command;
    return cached(this.deps, `media:${id}`, async () => {
      const usage = await this.deps.content.countMediaUsage(id);
      const [record] = usage > 0 ? await this.deps.mediaReader.findByIds([id]) : [];
      if (!record) throw new PublicItemNotFoundError();
      return {
        data: toPublicMedia(record),
        cacheTag: mediaTag(this.deps, [record]),
        lastModified: record.createdAt.toUTCString(),
      };
    });
  }
}

// Called when content leaves or joins the public set, so it does not wait for the TTL.
export class InvalidatePublicCache implements InvalidatePublicCacheUseCase {
  constructor(private readonly deps: Pick<PublicApiDeps, 'responseCache'>) {}

  execute(): Promise<void> {
    return this.deps.responseCache.invalidateAll();
  }
}
