import type {
  MediaCatalog,
  MediaReferenceReport,
} from '../../src/modules/content/application/ports/out/media-catalog.port.js';
import type {
  ContentCounts,
  ContentCriteria,
  ContentListItem,
  ContentRepository,
  ContentVersion,
  ContentVersionSummary,
  PublishedCriteria,
  PublishedListItem,
  PublishedParent,
} from '../../src/modules/content/application/ports/out/content-repository.port.js';
import type { Content } from '../../src/modules/content/domain/entities/content.entity.js';
import { type ContentType } from '../../src/modules/content/domain/entities/content.entity.js';
import {
  ConcurrentModificationError,
  SlugConflictError,
} from '../../src/modules/content/domain/errors/content.errors.js';
import { referencedMediaIds } from '../../src/modules/content/domain/services/media-references.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../src/shared/kernel/paged-result.js';

function matches(content: Content, criteria: ContentCriteria): boolean {
  const { status, type, authorId, tag, updatedFrom, updatedTo, search } = criteria;
  const filters: readonly (readonly [unknown, () => boolean])[] = [
    [type, () => content.type === type],
    [authorId, () => content.authorId === authorId],
    [tag, () => content.tags.includes(tag ?? '')],
    [updatedFrom, () => content.updatedAt >= (updatedFrom as Date)],
    [updatedTo, () => content.updatedAt <= (updatedTo as Date)],
    [search, () => content.title.toLowerCase().includes(search?.toLowerCase() ?? '')],
  ];
  const statusMatches =
    status === undefined ? content.status !== 'archived' : content.status === status;
  return (
    content.deletedAt === null &&
    statusMatches &&
    filters.every(([filter, passes]) => filter === undefined || passes())
  );
}

function isPublic(content: Content, now: Date): boolean {
  return (
    content.status === 'published' &&
    content.publishedAt !== null &&
    content.publishedAt <= now &&
    content.deletedAt === null
  );
}

export class InMemoryContentRepository implements ContentRepository {
  readonly contents = new Map<string, Content>();
  readonly versions: ContentVersion[] = [];
  // Set to act as another user saving between this caller's read and its write.
  failNextSave: Error | null = null;

  add(content: Content): void {
    this.contents.set(content.id, content);
  }

  delete(id: string): void {
    this.contents.delete(id);
  }

  get(id: string): Content {
    const content = this.contents.get(id);
    if (!content) throw new Error(`No content ${id}`);
    return content;
  }

  private publicParentOf(content: Content, now: Date): PublishedParent | null {
    const parent = content.parentId === null ? undefined : this.contents.get(content.parentId);
    return parent && isPublic(parent, now) ? { slug: parent.slug, title: parent.title } : null;
  }

  findPublished(
    criteria: PublishedCriteria,
    page: PageRequest,
    now: Date,
  ): Promise<PagedResult<PublishedListItem>> {
    const { type, tag, category } = criteria;
    const all = [...this.contents.values()]
      .filter(
        (content) =>
          isPublic(content, now) &&
          content.type === type &&
          (tag === undefined || content.tags.includes(tag)) &&
          (category === undefined || content.category === category),
      )
      .sort((a, b) => (b.publishedAt as Date).getTime() - (a.publishedAt as Date).getTime());
    const start = (page.page - 1) * page.pageSize;
    const items = all.slice(start, start + page.pageSize).map((content) => ({
      ...content,
      publishedAt: content.publishedAt as Date,
      parent: this.publicParentOf(content, now),
      authorName: `Name of ${content.authorId}`,
    }));
    return Promise.resolve(pagedResult(items, all.length, page));
  }

  findPublishedBySlug(
    type: ContentType,
    slug: string,
    now: Date,
  ): Promise<{ content: Content; authorName: string; parent: PublishedParent | null } | null> {
    const content = [...this.contents.values()].find(
      (candidate) => isPublic(candidate, now) && candidate.type === type && candidate.slug === slug,
    );
    return Promise.resolve(
      content
        ? {
            content,
            authorName: `Name of ${content.authorId}`,
            parent: this.publicParentOf(content, now),
          }
        : null,
    );
  }

  countPublishedMediaUsage(mediaId: string, now: Date): Promise<number> {
    const using = [...this.contents.values()].filter(
      (content) => isPublic(content, now) && referencedMediaIds(content).includes(mediaId),
    );
    return Promise.resolve(using.length);
  }

  findById(id: string): Promise<Content | null> {
    const content = this.contents.get(id);
    return Promise.resolve(content && content.deletedAt === null ? content : null);
  }

  findMany(criteria: ContentCriteria, page: PageRequest): Promise<PagedResult<ContentListItem>> {
    const sign = criteria.descending ? -1 : 1;
    const all = [...this.contents.values()]
      .filter((content) => matches(content, criteria))
      .sort((a, b) => sign * this.compare(a, b, criteria.sortBy));
    const start = (page.page - 1) * page.pageSize;
    const items = all.slice(start, start + page.pageSize).map((content) => ({
      ...content,
      authorName: `Name of ${content.authorId}`,
    }));
    return Promise.resolve(pagedResult(items, all.length, page));
  }

  private compare(a: Content, b: Content, field: ContentCriteria['sortBy']): number {
    if (field === 'title') return a.title.localeCompare(b.title);
    const date = (content: Content) =>
      field === 'created_at' ? content.createdAt : content.updatedAt;
    return date(a).getTime() - date(b).getTime();
  }

  countByStatus(authorId: string | null): Promise<ContentCounts> {
    const counts = { draft: 0, in_review: 0, published: 0, unpublished: 0, archived: 0 };
    for (const content of this.contents.values()) {
      if (content.deletedAt === null && (authorId === null || content.authorId === authorId)) {
        counts[content.status] += 1;
      }
    }
    return Promise.resolve(counts);
  }

  slugExists(type: ContentType, slug: string): Promise<boolean> {
    return Promise.resolve(this.holdsSlug(type, slug, null));
  }

  private holdsSlug(type: ContentType, slug: string, exceptId: string | null): boolean {
    return [...this.contents.values()].some(
      (content) =>
        content.type === type &&
        content.slug === slug &&
        content.id !== exceptId &&
        content.deletedAt === null,
    );
  }

  countMediaUsage(mediaId: string): Promise<number> {
    const using = [...this.contents.values()].filter(
      (content) => content.deletedAt === null && referencedMediaIds(content).includes(mediaId),
    );
    return Promise.resolve(using.length);
  }

  hasChildren(id: string): Promise<boolean> {
    return Promise.resolve(
      [...this.contents.values()].some(
        (content) => content.parentId === id && content.deletedAt === null,
      ),
    );
  }

  create(content: Content): Promise<void> {
    if (this.holdsSlug(content.type, content.slug, content.id)) {
      return Promise.reject(new SlugConflictError());
    }
    this.contents.set(content.id, content);
    return Promise.resolve();
  }

  save(content: Content): Promise<void> {
    if (this.failNextSave) {
      const error = this.failNextSave;
      this.failNextSave = null;
      return Promise.reject(error);
    }
    if (this.contents.get(content.id)?.version !== content.version - 1) {
      return Promise.reject(new ConcurrentModificationError());
    }
    if (this.holdsSlug(content.type, content.slug, content.id)) {
      return Promise.reject(new SlugConflictError());
    }
    this.contents.set(content.id, content);
    return Promise.resolve();
  }

  addVersion(version: ContentVersion, keep: number): Promise<void> {
    this.versions.push(version);
    const own = this.versions.filter((v) => v.contentId === version.contentId);
    for (const old of own.slice(0, Math.max(own.length - keep, 0))) {
      this.versions.splice(this.versions.indexOf(old), 1);
    }
    return Promise.resolve();
  }

  findVersions(contentId: string, page: PageRequest): Promise<PagedResult<ContentVersionSummary>> {
    const own = this.versions
      .filter((version) => version.contentId === contentId)
      .sort((a, b) => b.versionNo - a.versionNo);
    const start = (page.page - 1) * page.pageSize;
    return Promise.resolve(pagedResult(own.slice(start, start + page.pageSize), own.length, page));
  }

  findVersion(contentId: string, versionNo: number): Promise<ContentVersion | null> {
    const found = this.versions.find(
      (version) => version.contentId === contentId && version.versionNo === versionNo,
    );
    return Promise.resolve(found ?? null);
  }

  findDueForPublish(now: Date, limit: number): Promise<readonly string[]> {
    const due = [...this.contents.values()].filter(
      (content) =>
        content.deletedAt === null && content.scheduledAt !== null && content.scheduledAt <= now,
    );
    return Promise.resolve(due.slice(0, limit).map((content) => content.id));
  }

  purgeDeletedBefore(cutoff: Date, limit: number): Promise<readonly string[]> {
    const due = [...this.contents.values()]
      .filter((content) => content.deletedAt !== null && content.deletedAt < cutoff)
      .slice(0, limit)
      .map((content) => content.id);
    for (const id of due) this.contents.delete(id);
    return Promise.resolve(due);
  }
}

export class InMemoryMediaCatalog implements MediaCatalog {
  readonly missing = new Set<string>();
  readonly notImages = new Set<string>();

  inspectImages(ids: readonly string[]): Promise<MediaReferenceReport> {
    return Promise.resolve({
      missing: ids.filter((id) => this.missing.has(id)),
      notImages: ids.filter((id) => this.notImages.has(id)),
    });
  }
}
