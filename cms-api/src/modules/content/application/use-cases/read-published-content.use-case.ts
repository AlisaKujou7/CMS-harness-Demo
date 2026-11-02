import type { PagedResult, PageRequest } from '../../../../shared/kernel/paged-result.js';
import type { ContentType } from '../../domain/entities/content.entity.js';
import type { ContentDeps } from '../content-deps.js';
import type { PublishedContentQueries, PublishedDetail } from '../ports/in/content.ports.js';
import type { PublishedCriteria, PublishedListItem } from '../ports/out/content-repository.port.js';
import { toContentView } from '../services/content-helpers.js';

// What the public API asks through the composition root. The repository applies the one definition
// of public (FR-PUBAPI-03), and each call asks for it as of now.
export class ReadPublishedContent implements PublishedContentQueries {
  constructor(private readonly deps: Pick<ContentDeps, 'contents' | 'clock'>) {}

  list(criteria: PublishedCriteria, page: PageRequest): Promise<PagedResult<PublishedListItem>> {
    return this.deps.contents.findPublished(criteria, page, this.deps.clock.now());
  }

  async findBySlug(type: ContentType, slug: string): Promise<PublishedDetail | null> {
    const found = await this.deps.contents.findPublishedBySlug(type, slug, this.deps.clock.now());
    if (!found) return null;
    const view = toContentView(found.content);
    return { ...view, authorName: found.authorName, publishedAt: view.publishedAt as Date };
  }

  countMediaUsage(mediaId: string): Promise<number> {
    return this.deps.contents.countPublishedMediaUsage(mediaId, this.deps.clock.now());
  }
}
