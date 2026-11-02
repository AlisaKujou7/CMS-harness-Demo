import { Prisma, type MediaItem as MediaRow } from '../../../../../generated/prisma/client.js';
import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import { escapeLike } from '../../../../../shared/adapters/out/prisma-context.js';
import { defined } from '../../../../../shared/kernel/defined.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../../../../shared/kernel/paged-result.js';
import type {
  MediaCriteria,
  MediaRepository,
  MediaWithUploader,
  VariantResult,
} from '../../../application/ports/out/media-repository.port.js';
import {
  MediaItem,
  type MediaMetadata,
  type MediaVariants,
} from '../../../domain/entities/media-item.entity.js';
import { MediaAlreadyExistsError } from '../../../domain/errors/media.errors.js';

const UNIQUE_VIOLATION = 'P2002';
const IMAGE_PREFIX = 'image/';
const WITH_UPLOADER = { uploader: { select: { name: true } } } as const;

function toDomain(row: MediaRow): MediaItem {
  return MediaItem.restore({
    id: row.id,
    storageKey: row.storageKey,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    width: row.width,
    height: row.height,
    altText: row.altText,
    caption: row.caption,
    variants: row.variants as unknown as MediaVariants,
    variantStatus: row.variantStatus,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt,
  });
}

function toWithUploader(row: MediaRow & { uploader: { name: string } }): MediaWithUploader {
  return { item: toDomain(row), uploaderName: row.uploader.name };
}

function kindFilter(kind: MediaCriteria['kind']): Prisma.MediaItemWhereInput {
  if (kind === undefined) return {};
  const isImage = { mimeType: { startsWith: IMAGE_PREFIX } };
  return kind === 'image' ? isImage : { NOT: isImage };
}

function searchFilter(search: string | undefined): Prisma.MediaItemWhereInput {
  if (search === undefined) return {};
  const contains = { contains: escapeLike(search), mode: 'insensitive' as const };
  return { OR: [{ filename: contains }, { altText: contains }] };
}

function toWhere(criteria: MediaCriteria): Prisma.MediaItemWhereInput {
  const { search, uploadedBy, kind, from, to } = criteria;
  return {
    ...defined({ uploadedBy }),
    ...kindFilter(kind),
    ...searchFilter(search),
    createdAt: defined({ gte: from, lte: to }),
  };
}

export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly db: PrismaContext) {}

  async findById(id: string): Promise<MediaItem | null> {
    const row = await this.db.client.mediaItem.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async findWithUploader(id: string): Promise<MediaWithUploader | null> {
    const row = await this.db.client.mediaItem.findUnique({
      where: { id },
      include: WITH_UPLOADER,
    });
    return row && toWithUploader(row);
  }

  async findMany(
    criteria: MediaCriteria,
    page: PageRequest,
  ): Promise<PagedResult<MediaWithUploader>> {
    const where = toWhere(criteria);
    const [rows, total] = await Promise.all([
      this.db.client.mediaItem.findMany({
        where,
        include: WITH_UPLOADER,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.db.client.mediaItem.count({ where }),
    ]);
    return pagedResult(rows.map(toWithUploader), total, page);
  }

  async findMimeTypes(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const rows = await this.db.client.mediaItem.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, mimeType: true },
    });
    return new Map(rows.map((row) => [row.id, row.mimeType]));
  }

  async create(item: MediaItem): Promise<void> {
    try {
      await this.db.client.mediaItem.create({
        data: {
          id: item.id,
          storageKey: item.storageKey,
          filename: item.filename,
          mimeType: item.mimeType,
          sizeBytes: BigInt(item.sizeBytes),
          altText: item.altText,
          caption: item.caption,
          variants: item.variants as unknown as Prisma.InputJsonValue,
          variantStatus: item.variantStatus,
          uploadedBy: item.uploadedBy,
          createdAt: item.createdAt,
        },
      });
    } catch (error) {
      const isConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
      throw isConflict ? new MediaAlreadyExistsError() : error;
    }
  }

  async updateMetadata(id: string, changes: Partial<MediaMetadata>): Promise<void> {
    await this.db.client.mediaItem.update({ where: { id }, data: changes });
  }

  async saveVariants(id: string, result: VariantResult): Promise<boolean> {
    const { count } = await this.db.client.mediaItem.updateMany({
      where: { id },
      data: {
        width: result.width,
        height: result.height,
        variants: result.variants as unknown as Prisma.InputJsonValue,
        variantStatus: result.status,
      },
    });
    return count > 0;
  }

  async delete(id: string): Promise<void> {
    await this.db.client.mediaItem.delete({ where: { id } });
  }

  async failPendingVariantsBefore(cutoff: Date): Promise<number> {
    const { count } = await this.db.client.mediaItem.updateMany({
      where: { variantStatus: 'pending', createdAt: { lt: cutoff } },
      data: { variantStatus: 'failed' },
    });
    return count;
  }

  async addPendingFileDeletions(keys: readonly string[], at: Date): Promise<void> {
    await this.db.client.mediaFileDeletion.createMany({
      data: keys.map((key) => ({ key, createdAt: at })),
      skipDuplicates: true,
    });
  }

  async findPendingFileDeletions(limit: number): Promise<readonly string[]> {
    const rows = await this.db.client.mediaFileDeletion.findMany({
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.key);
  }

  async clearPendingFileDeletions(keys: readonly string[]): Promise<void> {
    await this.db.client.mediaFileDeletion.deleteMany({ where: { key: { in: [...keys] } } });
  }

  async findPendingVariants(createdBefore: Date, limit: number): Promise<readonly string[]> {
    const rows = await this.db.client.mediaItem.findMany({
      where: { variantStatus: 'pending', createdAt: { lt: createdBefore } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.id);
  }
}
