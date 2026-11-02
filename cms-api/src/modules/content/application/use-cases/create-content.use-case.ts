import { Content, type ContentType } from '../../domain/entities/content.entity.js';
import { Slug } from '../../domain/value-objects/slug.vo.js';
import type { ContentDeps } from '../content-deps.js';
import type {
  ContentView,
  CreateContentCommand,
  CreateContentUseCase,
} from '../ports/in/content.ports.js';
import {
  assertValidReferences,
  recordChange,
  sanitizedFields,
  toContentView,
} from '../services/content-helpers.js';

const MAX_SUFFIX = 20;
const ID_PREFIX_LENGTH = 8;

export class CreateContent implements CreateContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  execute(command: CreateContentCommand): Promise<ContentView> {
    return this.deps.tx.run(async () => {
      const { actor, ip, type, slug, ...patch } = command;
      const fields = sanitizedFields(patch);
      await assertValidReferences(this.deps, { id: null, category: null, parentId: null }, fields);

      const id = this.deps.ids.next();
      const content = Content.create({
        id,
        type,
        authorId: actor.id,
        slug: await this.chooseSlug({ id, type, title: command.title, slug }),
        now: this.deps.clock.now(),
        fields,
      });
      await this.deps.contents.create(content);
      await recordChange(this.deps, content, {
        actorId: actor.id,
        ip,
        action: 'content.create',
        summary: { type, title: content.title, slug: content.slug },
      });
      return toContentView(content);
    });
  }

  private async chooseSlug(input: {
    id: string;
    type: ContentType;
    title: string;
    slug: string | undefined;
  }): Promise<string> {
    const { contents } = this.deps;
    if (input.slug !== undefined) return input.slug;
    const idPrefix = input.id.slice(0, ID_PREFIX_LENGTH);
    const base = Slug.fromTitle(input.title, `content-${idPrefix}`).value;
    if (!(await contents.slugExists(input.type, base))) return base;
    for (let suffix = 2; suffix <= MAX_SUFFIX; suffix += 1) {
      const candidate = `${base}-${String(suffix)}`;
      if (!(await contents.slugExists(input.type, candidate))) return candidate;
    }
    return `${base}-${idPrefix}`;
  }
}
