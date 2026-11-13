import type { Actor } from '../../../../shared/kernel/actor.js';
import { type PagedResult, toPageRequest } from '../../../../shared/kernel/paged-result.js';
import type { ContentDeps } from '../content-deps.js';
import { assertCanRead, seesAllContent } from '../policies/content.policy.js';
import type {
  ContentCategoriesUseCase,
  ContentCounts,
  ContentListItem,
  ContentStatsUseCase,
  CountMediaUsageUseCase,
  ContentView,
  GetContentUseCase,
  ListContentCommand,
  ListContentUseCase,
} from '../ports/in/content.ports.js';
import { loadContent, toContentView } from '../services/content-helpers.js';

export class GetContent implements GetContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: { readonly actor: Actor; readonly id: string }): Promise<ContentView> {
    const content = await loadContent(this.deps.contents, command.id);
    assertCanRead(command.actor, content);
    return toContentView(content);
  }
}

export class ListContent implements ListContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  execute(command: ListContentCommand): Promise<PagedResult<ContentListItem>> {
    const { actor, page, pageSize, ...filters } = command;
    return this.deps.contents.findMany(
      {
        sortBy: 'updated_at',
        descending: true,
        ...filters,
        // Last, so no query parameter can widen what an Author sees (FR-AUTHZ-02).
        ...(seesAllContent(actor) ? {} : { authorId: actor.id }),
      },
      toPageRequest({
        ...(page === undefined ? {} : { page }),
        ...(pageSize === undefined ? {} : { pageSize }),
      }),
    );
  }
}

export class ContentCategories implements ContentCategoriesUseCase {
  constructor(private readonly deps: ContentDeps) {}

  execute(): readonly string[] {
    return this.deps.contentCategories;
  }
}

// What the media module asks through the composition root before it deletes a file.
export class CountMediaUsage implements CountMediaUsageUseCase {
  constructor(private readonly deps: Pick<ContentDeps, 'contents'>) {}

  execute(mediaId: string): Promise<number> {
    return this.deps.contents.countMediaUsage(mediaId);
  }
}

export class ContentStats implements ContentStatsUseCase {
  constructor(private readonly deps: ContentDeps) {}

  execute(command: { readonly actor: Actor }): Promise<ContentCounts> {
    const { actor } = command;
    return this.deps.contents.countByStatus(seesAllContent(actor) ? null : actor.id);
  }
}
