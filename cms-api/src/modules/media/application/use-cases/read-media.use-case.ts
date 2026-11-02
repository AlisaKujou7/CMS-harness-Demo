import { defined } from '../../../../shared/kernel/defined.js';
import { type PagedResult, toPageRequest } from '../../../../shared/kernel/paged-result.js';
import { MediaNotFoundError } from '../../domain/errors/media.errors.js';
import { isImage } from '../../domain/services/media-types.js';
import type { MediaDeps } from '../media-deps.js';
import type {
  GetMediaUseCase,
  GetMediaViewsUseCase,
  ImageReferenceReport,
  InspectImageReferencesUseCase,
  ListMediaUseCase,
  MediaDetailView,
  MediaView,
} from '../ports/in/media.ports.js';
import type { MediaCriteria } from '../ports/out/media-repository.port.js';
import { toMediaView } from '../services/media-helpers.js';

export class GetMedia implements GetMediaUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(command: { readonly id: string }): Promise<MediaDetailView> {
    const found = await this.deps.media.findWithUploader(command.id);
    if (!found) throw new MediaNotFoundError();
    const usageCount = await this.deps.usage.countUsage(command.id);
    return { ...(await toMediaView(this.deps, found.item, found.uploaderName)), usageCount };
  }
}

export class ListMedia implements ListMediaUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(
    command: MediaCriteria & { readonly page?: number; readonly pageSize?: number },
  ): Promise<PagedResult<MediaView>> {
    const { page, pageSize, ...criteria } = command;
    const result = await this.deps.media.findMany(
      criteria,
      toPageRequest(defined({ page, pageSize })),
    );
    const items = await Promise.all(
      result.items.map(({ item, uploaderName }) => toMediaView(this.deps, item, uploaderName)),
    );
    return { ...result, items };
  }
}

// What the public API asks through the composition root, so it never needs a storage key.
export class GetMediaViews implements GetMediaViewsUseCase {
  constructor(private readonly deps: Pick<MediaDeps, 'media' | 'storage' | 'mediaConfig'>) {}

  async execute(ids: readonly string[]): Promise<readonly MediaView[]> {
    const items = await this.deps.media.findByIds(ids);
    return Promise.all(items.map((item) => toMediaView(this.deps, item)));
  }
}

// What the content module asks through the composition root before it stores a reference.
export class InspectImageReferences implements InspectImageReferencesUseCase {
  constructor(private readonly deps: Pick<MediaDeps, 'media'>) {}

  async execute(ids: readonly string[]): Promise<ImageReferenceReport> {
    if (ids.length === 0) return { missing: [], notImages: [] };
    const types = await this.deps.media.findMimeTypes(ids);
    const typeOf = (id: string) => types.get(id.toLowerCase());
    return {
      missing: ids.filter((id) => typeOf(id) === undefined),
      notImages: ids.filter((id) => {
        const type = typeOf(id);
        return type !== undefined && !isImage(type);
      }),
    };
  }
}
