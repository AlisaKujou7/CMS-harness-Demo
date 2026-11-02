import { Content, type ContentType } from '../../domain/entities/content.entity.js';
import { SlugConflictError } from '../../domain/errors/content.errors.js';
import { safeText } from '../../domain/services/text-safety.js';
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
const MAX_ATTEMPTS = 5;

export class CreateContent implements CreateContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  // Someone creating the same title at the same moment can take a generated slug between the check
  // and the insert. The caller chose no slug and has nothing to correct, so this picks another. The
  // last attempt uses the new id, which nobody else can hold.
  async execute(command: CreateContentCommand): Promise<ContentView> {
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.attempt(command, false);
      } catch (error) {
        if (command.slug !== undefined || !(error instanceof SlugConflictError)) throw error;
      }
    }
    return this.attempt(command, true);
  }

  private attempt(command: CreateContentCommand, forceUnique: boolean): Promise<ContentView> {
    return this.deps.tx.run(async () => {
      const { actor, ip, type, slug, ...patch } = command;
      const fields = sanitizedFields(patch);
      await assertValidReferences(this.deps, { id: null, category: null, parentId: null }, fields);

      const id = this.deps.ids.next();
      const content = Content.create({
        id,
        type,
        authorId: actor.id,
        slug: await this.chooseSlug({ id, type, title: command.title, slug, forceUnique }),
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
    forceUnique: boolean;
  }): Promise<string> {
    const { contents } = this.deps;
    if (input.slug !== undefined) return input.slug;
    const idPrefix = input.id.slice(0, ID_PREFIX_LENGTH);
    const base = Slug.fromTitle(safeText(input.title), `content-${idPrefix}`).value;
    if (input.forceUnique) return `${base}-${idPrefix}`;
    if (!(await contents.slugExists(input.type, base))) return base;
    for (let suffix = 2; suffix <= MAX_SUFFIX; suffix += 1) {
      const candidate = `${base}-${String(suffix)}`;
      if (!(await contents.slugExists(input.type, candidate))) return candidate;
    }
    return `${base}-${idPrefix}`;
  }
}
