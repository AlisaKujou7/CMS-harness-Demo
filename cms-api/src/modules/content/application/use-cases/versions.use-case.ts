import type { Actor } from '../../../../shared/kernel/actor.js';
import { type PagedResult, toPageRequest } from '../../../../shared/kernel/paged-result.js';
import type { ContentEdit } from '../../domain/entities/content.entity.js';
import { ContentNotFoundError } from '../../domain/errors/content.errors.js';
import { referencedMediaIds, withoutMedia } from '../../domain/services/media-references.js';
import type { ContentDeps } from '../content-deps.js';
import { assertCanEdit, assertCanReadHistory } from '../policies/content.policy.js';
import type {
  ContentCommand,
  ContentVersionDetail,
  ContentVersionSummary,
  ContentView,
  GetContentVersionUseCase,
  ListContentVersionsUseCase,
  RevertContentUseCase,
} from '../ports/in/content.ports.js';
import type { ContentSnapshot, ContentVersion } from '../ports/out/content-repository.port.js';
import {
  assertValidReferences,
  loadContent,
  mutateContent,
  toContentView,
} from '../services/content-helpers.js';

// A revert changes what the item says, not where it is in its lifecycle.
function revertedFields(snapshot: ContentSnapshot): ContentEdit {
  return {
    title: snapshot.title,
    slug: snapshot.slug,
    body: snapshot.body,
    featuredImageId: snapshot.featuredImageId,
    socialImageId: snapshot.socialImageId,
    seoTitle: snapshot.seoTitle,
    seoDescription: snapshot.seoDescription,
    tags: snapshot.tags,
    category: snapshot.category,
    parentId: snapshot.parentId,
  };
}

async function loadVersion(
  deps: ContentDeps,
  contentId: string,
  versionNo: number,
): Promise<ContentVersion> {
  const version = await deps.contents.findVersion(contentId, versionNo);
  if (!version) throw new ContentNotFoundError();
  return version;
}

export class ListContentVersions implements ListContentVersionsUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: {
    readonly actor: Actor;
    readonly id: string;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<PagedResult<ContentVersionSummary>> {
    const { actor, id, ...paging } = command;
    assertCanReadHistory(actor, await loadContent(this.deps.contents, id));
    return this.deps.contents.findVersions(id, toPageRequest(paging));
  }
}

export class GetContentVersion implements GetContentVersionUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: {
    readonly actor: Actor;
    readonly id: string;
    readonly versionNo: number;
  }): Promise<ContentVersionDetail> {
    assertCanReadHistory(command.actor, await loadContent(this.deps.contents, command.id));
    return loadVersion(this.deps, command.id, command.versionNo);
  }
}

export class RevertContent implements RevertContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: ContentCommand & { readonly versionNo: number }): Promise<ContentView> {
    const { actor, id, ip, versionNo } = command;
    let dropped: readonly string[] = [];
    const content = await mutateContent(this.deps, {
      actor,
      id,
      ip,
      action: 'content.revert',
      authorize: (current) => {
        assertCanEdit(actor, current);
      },
      change: async (current) => {
        const { snapshot } = await loadVersion(this.deps, id, versionNo);
        // Media can be force-deleted after a version was saved. The rest is still worth restoring,
        // and the audit event says what could not come back.
        const fields = revertedFields(snapshot);
        const report = await this.deps.mediaCatalog.inspectImages(referencedMediaIds(fields));
        dropped = report.missing;
        const restorable = withoutMedia(fields, dropped);
        await assertValidReferences(this.deps, current, restorable);
        return current.edit(restorable, this.deps.clock.now());
      },
      summary: () => ({
        to_version: versionNo,
        ...(dropped.length > 0 ? { dropped_media: dropped } : {}),
      }),
    });
    return toContentView(content);
  }
}
