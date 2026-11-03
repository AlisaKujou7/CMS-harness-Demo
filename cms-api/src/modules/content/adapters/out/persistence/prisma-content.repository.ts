import {
  Prisma,
  type Content as ContentRow,
  type ContentVersion as ContentVersionRow,
} from '../../../../../generated/prisma/client.js';
import {
  escapeLike,
  type PrismaContext,
} from '../../../../../shared/adapters/out/prisma-context.js';
import { defined } from '../../../../../shared/kernel/defined.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../../../../shared/kernel/paged-result.js';
import type {
  ContentCounts,
  ContentCriteria,
  ContentListItem,
  ContentRepository,
  ContentSnapshot,
  ContentSortField,
  ContentVersion,
  ContentVersionSummary,
  PublishedCriteria,
  PublishedListItem,
  PublishedParent,
} from '../../../application/ports/out/content-repository.port.js';
import { Content, type ContentType } from '../../../domain/entities/content.entity.js';
import {
  ConcurrentModificationError,
  MissingMediaError,
  SlugConflictError,
} from '../../../domain/errors/content.errors.js';
import { referencedMediaIds } from '../../../domain/services/media-references.js';
import type { RichTextNode } from '../../../domain/services/rich-text.js';

const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';

const SORT_COLUMNS: Readonly<Record<ContentSortField, 'updatedAt' | 'createdAt' | 'title'>> = {
  updated_at: 'updatedAt',
  created_at: 'createdAt',
  title: 'title',
};

// A foreign key failure here means the media was force-deleted after it was checked.
function translateWriteError(error: unknown, content: Content): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;
  if (error.code === UNIQUE_VIOLATION) return new SlugConflictError();
  const isMedia =
    error.code === FOREIGN_KEY_VIOLATION &&
    /(featured|social)_image_id/.test(`${error.message} ${JSON.stringify(error.meta)}`);
  return isMedia
    ? new MissingMediaError(
        referencedMediaIds({
          featuredImageId: content.featuredImageId,
          socialImageId: content.socialImageId,
        }),
      )
    : error;
}

function toDomain(row: ContentRow): Content {
  return Content.restore({ ...row, body: row.body as unknown as RichTextNode });
}

function toVersion(row: ContentVersionRow): ContentVersion {
  return {
    id: row.id,
    contentId: row.contentId,
    versionNo: row.versionNo,
    snapshot: row.snapshot as unknown as ContentSnapshot,
    editorId: row.editorId,
    createdAt: row.createdAt,
  };
}

function toEditableColumns(content: Content) {
  return {
    title: content.title,
    slug: content.slug,
    body: content.body as unknown as Prisma.InputJsonValue,
    status: content.status,
    featuredImageId: content.featuredImageId,
    socialImageId: content.socialImageId,
    referencedMediaIds: [...referencedMediaIds(content)],
    seoTitle: content.seoTitle,
    seoDescription: content.seoDescription,
    tags: [...content.tags],
    category: content.category,
    parentId: content.parentId,
    scheduledAt: content.scheduledAt,
    publishedAt: content.publishedAt,
    deletedAt: content.deletedAt,
    reviewNote: content.reviewNote,
    version: content.version,
    updatedAt: content.updatedAt,
  };
}

function toWhere(criteria: ContentCriteria): Prisma.ContentWhereInput {
  const { status, type, authorId, tag, updatedFrom, updatedTo, search } = criteria;
  return {
    deletedAt: null,
    // Archived items stay out of the way unless someone asks for them.
    status: status ?? { not: 'archived' },
    ...defined({ type, authorId }),
    ...(tag === undefined ? {} : { tags: { has: tag } }),
    updatedAt: defined({ gte: updatedFrom, lte: updatedTo }),
    ...(search === undefined
      ? {}
      : { title: { contains: escapeLike(search), mode: 'insensitive' as const } }),
  };
}

function publicWhere(now: Date) {
  return { status: 'published', publishedAt: { lte: now }, deletedAt: null } as const;
}

const PARENT_FIELDS = {
  slug: true,
  title: true,
  status: true,
  publishedAt: true,
  deletedAt: true,
} as const;

// The same rule as publicWhere, for a row a query has already joined.
function publicParent(
  parent: {
    slug: string;
    title: string;
    status: string;
    publishedAt: Date | null;
    deletedAt: Date | null;
  } | null,
  now: Date,
): PublishedParent | null {
  if (parent?.status !== 'published' || parent.deletedAt !== null) return null;
  if (parent.publishedAt === null || parent.publishedAt > now) return null;
  return { slug: parent.slug, title: parent.title };
}

export class PrismaContentRepository implements ContentRepository {
  constructor(private readonly db: PrismaContext) {}

  async findPublished(
    criteria: PublishedCriteria,
    page: PageRequest,
    now: Date,
  ): Promise<PagedResult<PublishedListItem>> {
    const { type, tag, category } = criteria;
    const where: Prisma.ContentWhereInput = {
      ...publicWhere(now),
      type,
      ...(tag === undefined ? {} : { tags: { has: tag } }),
      ...defined({ category }),
    };
    const [rows, total] = await Promise.all([
      this.db.client.content.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          tags: true,
          category: true,
          parent: { select: PARENT_FIELDS },
          featuredImageId: true,
          version: true,
          publishedAt: true,
          updatedAt: true,
          author: { select: { name: true } },
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.db.client.content.count({ where }),
    ]);
    const items = rows.map(({ author, publishedAt, parent, ...row }) => ({
      ...row,
      parent: publicParent(parent, now),
      authorName: author.name,
      publishedAt: publishedAt as Date,
    }));
    return pagedResult(items, total, page);
  }

  async findPublishedBySlug(
    type: ContentType,
    slug: string,
    now: Date,
  ): Promise<{ content: Content; authorName: string; parent: PublishedParent | null } | null> {
    const row = await this.db.client.content.findFirst({
      where: { ...publicWhere(now), type, slug },
      include: { author: { select: { name: true } }, parent: { select: PARENT_FIELDS } },
    });
    return (
      row && {
        content: toDomain(row),
        authorName: row.author.name,
        parent: publicParent(row.parent, now),
      }
    );
  }

  countPublishedMediaUsage(mediaId: string, now: Date): Promise<number> {
    return this.db.client.content.count({
      where: { ...publicWhere(now), referencedMediaIds: { has: mediaId } },
    });
  }

  async findById(id: string): Promise<Content | null> {
    const row = await this.db.client.content.findFirst({ where: { id, deletedAt: null } });
    return row && toDomain(row);
  }

  async findMany(
    criteria: ContentCriteria,
    page: PageRequest,
  ): Promise<PagedResult<ContentListItem>> {
    const where = toWhere(criteria);
    const direction = criteria.descending ? ('desc' as const) : ('asc' as const);
    const [rows, total] = await Promise.all([
      this.db.client.content.findMany({
        where,
        omit: { body: true, referencedMediaIds: true },
        include: { author: { select: { name: true } } },
        orderBy: [{ [SORT_COLUMNS[criteria.sortBy]]: direction }, { id: 'desc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.db.client.content.count({ where }),
    ]);
    const items = rows.map(({ author, ...row }) => ({ ...row, authorName: author.name }));
    return pagedResult(items, total, page);
  }

  async countByStatus(authorId: string | null): Promise<ContentCounts> {
    const groups = await this.db.client.content.groupBy({
      by: ['status'],
      where: { deletedAt: null, ...(authorId === null ? {} : { authorId }) },
      _count: { _all: true },
    });
    const counts = { draft: 0, in_review: 0, published: 0, unpublished: 0, archived: 0 };
    for (const group of groups) counts[group.status] = group._count._all;
    return counts;
  }

  async slugExists(type: ContentType, slug: string): Promise<boolean> {
    const row = await this.db.client.content.findFirst({
      where: { type, slug, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  countMediaUsage(mediaId: string): Promise<number> {
    return this.db.client.content.count({
      where: { deletedAt: null, referencedMediaIds: { has: mediaId } },
    });
  }

  async hasChildren(id: string): Promise<boolean> {
    const count = await this.db.client.content.count({ where: { parentId: id, deletedAt: null } });
    return count > 0;
  }

  async create(content: Content): Promise<void> {
    try {
      await this.db.client.content.create({
        data: {
          ...toEditableColumns(content),
          id: content.id,
          type: content.type,
          authorId: content.authorId,
          createdAt: content.createdAt,
        },
      });
    } catch (error) {
      throw translateWriteError(error, content);
    }
  }

  async save(content: Content): Promise<void> {
    let updated: number;
    try {
      const result = await this.db.client.content.updateMany({
        where: { id: content.id, version: content.version - 1 },
        data: toEditableColumns(content),
      });
      updated = result.count;
    } catch (error) {
      throw translateWriteError(error, content);
    }
    if (updated === 0) throw new ConcurrentModificationError();
  }

  async addVersion(version: ContentVersion, keep: number): Promise<void> {
    await this.db.client.contentVersion.create({
      data: {
        id: version.id,
        contentId: version.contentId,
        versionNo: version.versionNo,
        snapshot: version.snapshot as unknown as Prisma.InputJsonValue,
        editorId: version.editorId,
        createdAt: version.createdAt,
      },
    });
    await this.db.client.contentVersion.deleteMany({
      where: { contentId: version.contentId, versionNo: { lte: version.versionNo - keep } },
    });
  }

  async findVersions(
    contentId: string,
    page: PageRequest,
  ): Promise<PagedResult<ContentVersionSummary>> {
    const [rows, total] = await Promise.all([
      this.db.client.contentVersion.findMany({
        where: { contentId },
        omit: { snapshot: true },
        orderBy: { versionNo: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.db.client.contentVersion.count({ where: { contentId } }),
    ]);
    return pagedResult(rows, total, page);
  }

  async findVersion(contentId: string, versionNo: number): Promise<ContentVersion | null> {
    const row = await this.db.client.contentVersion.findUnique({
      where: { contentId_versionNo: { contentId, versionNo } },
    });
    return row && toVersion(row);
  }

  async findDueForPublish(now: Date, limit: number): Promise<readonly string[]> {
    const rows = await this.db.client.content.findMany({
      where: { scheduledAt: { lte: now }, deletedAt: null },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.id);
  }

  async purgeDeletedBefore(cutoff: Date, limit: number): Promise<readonly string[]> {
    const rows = await this.db.client.content.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { deletedAt: 'asc' },
      take: limit,
    });
    const ids = rows.map((row) => row.id);
    await this.db.client.content.deleteMany({ where: { id: { in: ids } } });
    return ids;
  }
}
