import { defined } from '../../../../shared/kernel/defined.js';
import { toPageRequest } from '../../../../shared/kernel/paged-result.js';
import type {
  ListPublishedContentCommand,
  ListPublishedContentUseCase,
  PublicContentList,
  PublicResponse,
} from '../ports/in/public-api.ports.js';
import { cached, mediaTag, toPublicMedia, toSummary } from '../services/public-helpers.js';
import type { PublicApiDeps } from '../public-api-deps.js';

const EPOCH = new Date(0);

export class ListPublishedContent implements ListPublishedContentUseCase {
  constructor(private readonly deps: PublicApiDeps) {}

  execute(command: ListPublishedContentCommand): Promise<PublicResponse<PublicContentList>> {
    const { type, tag, category, page, pageSize } = command;
    const request = toPageRequest(defined({ page, pageSize }));
    const key = `list:${JSON.stringify([type, tag, category, request.page, request.pageSize])}`;

    return cached(this.deps, key, async () => {
      const result = await this.deps.content.list({ type, ...defined({ tag, category }) }, request);
      const featuredIds = result.items.flatMap((item) => item.featuredImageId ?? []);
      const media =
        featuredIds.length > 0 ? await this.deps.mediaReader.findByIds(featuredIds) : [];
      const byId = new Map(media.map((record) => [record.id, record]));
      const items = result.items.map((item) => {
        const image = item.featuredImageId === null ? undefined : byId.get(item.featuredImageId);
        return toSummary(item, image ? toPublicMedia(image) : null);
      });
      const versions = result.items.map((item) => `${item.id}:${String(item.version)}`);
      return {
        data: {
          items,
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          },
        },
        // The total is in, so removing an item from a later page still changes this page's tag.
        cacheTag: [key, result.total, versions.join(','), mediaTag(this.deps, media)].join('|'),
        lastModified: new Date(
          Math.max(EPOCH.getTime(), ...result.items.map((item) => item.updatedAt.getTime())),
        ).toUTCString(),
      };
    });
  }
}
