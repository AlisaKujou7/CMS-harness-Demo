import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aContent, aTextBody } from '../../../../../test/builders/a-content.js';
import {
  InMemoryContentRepository,
  InMemoryMediaCatalog,
} from '../../../../../test/fakes/content.fakes.js';
import {
  FakeClock,
  FakeTransactionRunner,
  InMemoryAuditLog,
  InMemoryLogger,
  RecordingEventPublisher,
  SequentialIdGenerator,
} from '../../../../../test/fakes/system.fakes.js';
import type { Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';
import { Content } from '../../domain/entities/content.entity.js';
import {
  ConcurrentModificationError,
  ContentNotFoundError,
  ContentScheduledError,
  InvalidContentError,
  InvalidTransitionError,
  MissingMediaError,
  MissingRequiredFieldsError,
  SlugConflictError,
} from '../../domain/errors/content.errors.js';
import type { ContentDeps } from '../content-deps.js';
import { CreateContent } from './create-content.use-case.js';
import {
  ArchiveContent,
  DeleteContent,
  UndoUnpublishContent,
  RestoreContent,
  PublishContent,
  RejectContent,
  ScheduleContent,
  SubmitContent,
  UnpublishContent,
} from './lifecycle.use-case.js';
import { ReadPublishedContent } from './read-published-content.use-case.js';
import { PublishDueContent } from './publish-due-content.use-case.js';
import { PurgeDeletedContent } from './purge-deleted-content.use-case.js';
import {
  ContentCategories,
  ContentStats,
  CountMediaUsage,
  GetContent,
  ListContent,
} from './read-content.use-case.js';
import { UpdateContent } from './update-content.use-case.js';
import { GetContentVersion, ListContentVersions, RevertContent } from './versions.use-case.js';

const admin: Actor = { id: 'admin-1', role: 'admin' };
const editor: Actor = { id: 'editor-1', role: 'editor' };
const author: Actor = { id: 'author-1', role: 'author' };
const otherAuthor: Actor = { id: 'author-2', role: 'author' };
const IP = '203.0.113.9';
const ID = '11111111-1111-4111-8111-111111111111';
const DAY_MS = 86_400_000;

describe('content use cases', () => {
  let contents: InMemoryContentRepository;
  let audit: InMemoryAuditLog;
  let events: RecordingEventPublisher;
  let tx: FakeTransactionRunner;
  let clock: FakeClock;
  let logger: InMemoryLogger;
  let deps: ContentDeps;
  const MEDIA = '77777777-7777-4777-8777-777777777777';
  const GONE = '88888888-8888-4888-8888-888888888888';
  let mediaCatalog: InMemoryMediaCatalog;

  const stored = (overrides: Parameters<typeof aContent>[0] = {}) => {
    const content = aContent({ id: ID, authorId: author.id, ...overrides });
    contents.add(content);
    return content;
  };
  const command = (actor: Actor) => ({ actor, id: ID, ip: IP });
  const publishable = { body: aTextBody('Some text') };

  beforeEach(() => {
    contents = new InMemoryContentRepository();
    audit = new InMemoryAuditLog();
    events = new RecordingEventPublisher();
    tx = new FakeTransactionRunner();
    clock = new FakeClock('2026-06-01T00:00:00Z');
    logger = new InMemoryLogger();
    mediaCatalog = new InMemoryMediaCatalog();
    mediaCatalog.missing.add(GONE);
    deps = {
      contents,
      audit,
      events,
      tx,
      clock,
      logger,
      ids: new SequentialIdGenerator(),
      contentCategories: ['news', 'guides'],
      mediaCatalog,
    };
  });

  describe('CreateContent', () => {
    const create = (overrides: Partial<Parameters<CreateContent['execute']>[0]> = {}) =>
      new CreateContent(deps).execute({
        actor: author,
        ip: IP,
        type: 'article',
        title: 'Hello World',
        ...overrides,
      });

    it('saves a draft with only a title, owned by the actor (FR-CONTENT-05)', async () => {
      const view = await create();

      expect(view).toMatchObject({
        title: 'Hello World',
        slug: 'hello-world',
        status: 'draft',
        authorId: author.id,
        version: 1,
        effectiveSeo: { title: 'Hello World', description: '' },
      });
      expect(contents.get(view.id).type).toBe('article');
    });

    it('records the first version and an audit event in one transaction', async () => {
      const view = await create();

      expect(tx.runs).toBe(1);
      expect(contents.versions).toHaveLength(1);
      expect(contents.versions[0]).toMatchObject({
        contentId: view.id,
        versionNo: 1,
        editorId: author.id,
        snapshot: { title: 'Hello World', slug: 'hello-world', status: 'draft' },
      });
      expect(audit.events[0]).toMatchObject({
        actorId: author.id,
        actorIp: IP,
        action: 'content.create',
        targetType: 'content',
        targetId: view.id,
        summary: { type: 'article', title: 'Hello World', slug: 'hello-world' },
      });
    });

    it('stores the body sanitized (SEC-04)', async () => {
      const view = await create({
        body: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>ok' }] },
          ],
        },
      });

      expect(view.body).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }],
      });
    });

    it('refuses a body that is not a document', async () => {
      await expect(create({ body: 'nope' })).rejects.toThrow(InvalidContentError);
    });

    it('adds a suffix when the generated slug is taken (FR-CONTENT-02)', async () => {
      await create();
      await expect(create()).resolves.toMatchObject({ slug: 'hello-world-2' });
      await expect(create()).resolves.toMatchObject({ slug: 'hello-world-3' });
    });

    it('allows the same generated slug on another type', async () => {
      await create();
      await expect(create({ type: 'page' })).resolves.toMatchObject({ slug: 'hello-world' });
    });

    it('falls back to one based on the id when a title has no Latin characters', async () => {
      const view = await create({ title: 'สวัสดีชาวโลก' });

      expect(view.slug).toBe(`content-${view.id.slice(0, 8)}`);
    });

    it('stops looking after a limit and uses the id instead of searching forever', async () => {
      for (let n = 0; n < 21; n += 1) await create();

      const views = [...contents.contents.values()];
      const last = views[views.length - 1];
      expect(last?.slug).toBe(`hello-world-${String(last?.id.slice(0, 8))}`);
    });

    describe('when someone takes a generated slug at the same moment', () => {
      const conflictTimes = (times: number) => {
        const insert = contents.create.bind(contents);
        let remaining = times;
        contents.create = (content) => {
          if (remaining === 0) return insert(content);
          remaining -= 1;
          return Promise.reject(new SlugConflictError());
        };
      };

      it('tries again instead of asking the caller to fix a slug they never chose', async () => {
        conflictTimes(1);

        await expect(create()).resolves.toMatchObject({ slug: 'hello-world' });
        expect(tx.runs).toBe(2);
      });

      it('falls back to the id on the last attempt', async () => {
        conflictTimes(4);

        const view = await create();

        expect(view.slug).toBe(`hello-world-${view.id.slice(0, 8)}`);
        expect(tx.runs).toBe(5);
      });

      it('reports the conflict for a slug the caller chose', async () => {
        conflictTimes(1);

        await expect(create({ slug: 'mine' })).rejects.toThrow(SlugConflictError);
        expect(tx.runs).toBe(1);
      });

      it('does not retry any other failure', async () => {
        contents.create = () => Promise.reject(new Error('database went away'));

        await expect(create()).rejects.toThrow('database went away');
        expect(tx.runs).toBe(1);
      });
    });

    it('takes the slug from the title without its markup', async () => {
      await expect(create({ title: '<script>x</script>Clean title' })).resolves.toMatchObject({
        title: 'Clean title',
        slug: 'clean-title',
      });
    });

    it('can reuse the slug of a deleted item', async () => {
      contents.add(aContent({ id: 'gone', slug: 'hello-world', deletedAt: new Date() }));

      await expect(create()).resolves.toMatchObject({ slug: 'hello-world' });
    });

    it('uses a supplied slug and refuses one that is taken (FR-CONTENT-03)', async () => {
      await expect(create({ slug: 'Custom-Slug' })).resolves.toMatchObject({ slug: 'custom-slug' });
      await expect(create({ slug: 'custom-slug' })).rejects.toThrow(SlugConflictError);
    });

    describe('media references', () => {
      const bodyWith = (mediaId: string) => ({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: '/a.png', mediaId } }],
      });

      it('accepts media that exists', async () => {
        await expect(
          create({ featuredImageId: MEDIA, socialImageId: MEDIA, body: bodyWith(MEDIA) }),
        ).resolves.toMatchObject({ featuredImageId: MEDIA, socialImageId: MEDIA });
      });

      it('refuses a file that is not an image', async () => {
        mediaCatalog.notImages.add(MEDIA);

        await expect(create({ featuredImageId: MEDIA })).rejects.toMatchObject({
          code: 'MEDIA_NOT_IMAGE',
          details: { ids: [MEDIA] },
        });
      });

      it.each([
        ['a featured image', { featuredImageId: GONE }],
        ['a social image', { socialImageId: GONE }],
        ['an image in the body', { body: bodyWith(GONE) }],
      ])('refuses %s that does not exist', async (_name, fields) => {
        await expect(create(fields)).rejects.toMatchObject({
          code: 'MEDIA_NOT_FOUND',
          details: { ids: [GONE] },
        });
      });
    });

    it('accepts a predefined category and refuses any other', async () => {
      await expect(create({ category: 'news' })).resolves.toMatchObject({ category: 'news' });
      await expect(create({ category: 'gossip' })).rejects.toMatchObject({
        details: { field: 'category' },
      });
    });

    describe('a parent page', () => {
      const PARENT = '22222222-2222-4222-8222-222222222222';
      const page = (parentId: string) => create({ type: 'page', parentId });

      it('is accepted when it is a top-level page', async () => {
        contents.add(aContent({ id: PARENT, type: 'page', slug: 'parent' }));

        await expect(page(PARENT)).resolves.toMatchObject({ parentId: PARENT });
      });

      it.each([
        ['does not exist', () => undefined],
        [
          'is an article',
          () => {
            contents.add(aContent({ id: PARENT, type: 'article', slug: 'p' }));
          },
        ],
        [
          'has its own parent',
          () => {
            contents.add(aContent({ id: PARENT, type: 'page', slug: 'p', parentId: ID }));
          },
        ],
      ])('is refused when it %s', async (_name, arrange) => {
        arrange();

        await expect(page(PARENT)).rejects.toMatchObject({
          code: 'VALIDATION_ERROR',
          details: { field: 'parentId' },
        });
      });
    });
  });

  describe('UpdateContent', () => {
    const update = (actor: Actor, changes: object = { title: 'New title' }, version = 3) =>
      new UpdateContent(deps).execute({ ...command(actor), version, ...changes });

    it('saves changes, a new version and an audit event naming the fields', async () => {
      stored({ version: 3, title: 'Old' });

      const view = await update(author);

      expect(view).toMatchObject({ title: 'New title', version: 4 });
      expect(contents.versions[0]).toMatchObject({ versionNo: 4, editorId: author.id });
      expect(audit.events[0]).toMatchObject({
        action: 'content.update',
        targetId: ID,
        summary: { fields: ['title'] },
      });
    });

    it('sanitizes a new body and applies null to clear a field', async () => {
      stored({ version: 3, seoTitle: 'SEO', tags: ['a'] });

      const view = await update(editor, {
        body: { type: 'doc', content: [{ type: 'evil', content: [] }] },
        seoTitle: null,
        tags: [],
      });

      expect(view.body).toEqual({ type: 'doc', content: [] });
      expect(view.seoTitle).toBeNull();
      expect(view.tags).toEqual([]);
    });

    it('changes nothing when nothing differs', async () => {
      stored({ version: 3, title: 'Same' });

      const view = await update(author, { title: 'Same' });

      expect(view.version).toBe(3);
      expect(contents.versions).toHaveLength(0);
      expect(audit.events).toHaveLength(0);
    });

    it('leaves unpublished content alone when nothing differs', async () => {
      stored({ version: 3, status: 'unpublished', title: 'Same' });

      await expect(update(author, { title: 'Same' })).resolves.toMatchObject({
        status: 'unpublished',
        version: 3,
      });
    });

    it('sees an unchanged body as unchanged whatever order its keys came back in', async () => {
      stored({
        version: 3,
        body: {
          content: [{ content: [{ text: 'Same', type: 'text' }], type: 'paragraph' }],
          type: 'doc',
        },
      });

      const view = await update(author, { body: aTextBody('Same') });

      expect(view.version).toBe(3);
      expect(contents.versions).toEqual([]);
    });

    it('still sees a real change to the body', async () => {
      stored({ version: 3, body: aTextBody('Before') });

      const view = await update(author, { body: aTextBody('After') });

      expect(view.version).toBe(4);
      expect(audit.events[0]?.summary).toEqual({ fields: ['body'] });
    });

    it('refuses a save from a version someone else has moved past (conflict dialog)', async () => {
      stored({ version: 4 });

      await expect(update(author, {}, 3)).rejects.toThrow(ConcurrentModificationError);
    });

    it('moves unpublished content back to draft (5.4.1)', async () => {
      stored({ version: 3, status: 'unpublished', ...publishable });

      await expect(update(author)).resolves.toMatchObject({ status: 'draft' });
    });

    it('refuses a slug held by another item', async () => {
      contents.add(aContent({ id: 'other', slug: 'taken' }));
      stored({ version: 3 });

      await expect(update(editor, { slug: 'taken' })).rejects.toThrow(SlugConflictError);
    });

    it('does not recheck media it already refers to, which may since have been force-deleted', async () => {
      stored({ version: 3, featuredImageId: GONE });

      await expect(update(author, { title: 'Fine', featuredImageId: GONE })).resolves.toMatchObject(
        {
          title: 'Fine',
        },
      );
    });

    it('checks media it did not refer to before', async () => {
      stored({ version: 3 });

      await expect(update(author, { socialImageId: GONE })).rejects.toThrow(MissingMediaError);
    });

    it('allows clearing a media reference', async () => {
      stored({ version: 3, featuredImageId: MEDIA });

      await expect(update(author, { featuredImageId: null })).resolves.toMatchObject({
        featuredImageId: null,
      });
    });

    it('refuses an unknown category but keeps an existing one unchecked when untouched', async () => {
      stored({ version: 3, category: 'retired' });

      await expect(update(editor, { category: 'gossip' })).rejects.toMatchObject({
        details: { field: 'category' },
      });
      await expect(update(editor, { title: 'Fine' })).resolves.toMatchObject({
        category: 'retired',
      });
    });

    it('allows clearing a category', async () => {
      stored({ version: 3, category: 'news' });

      await expect(update(editor, { category: null })).resolves.toMatchObject({ category: null });
    });

    describe('page hierarchy', () => {
      const PARENT = '22222222-2222-4222-8222-222222222222';

      it('refuses a page as its own parent', async () => {
        stored({ version: 3, type: 'page' });

        await expect(update(editor, { parentId: ID })).rejects.toMatchObject({
          details: { field: 'parentId' },
        });
      });

      it('refuses a parent for a page that already has children (single level)', async () => {
        stored({ version: 3, type: 'page' });
        contents.add(aContent({ id: PARENT, type: 'page', slug: 'parent' }));
        contents.add(aContent({ id: 'child', type: 'page', slug: 'child', parentId: ID }));

        await expect(update(editor, { parentId: PARENT })).rejects.toMatchObject({
          details: { field: 'parentId' },
        });
      });

      it('allows removing a parent', async () => {
        stored({ version: 3, type: 'page', parentId: PARENT });

        await expect(update(editor, { parentId: null })).resolves.toMatchObject({ parentId: null });
      });
    });

    describe('who may edit (FR-AUTHZ-02, 03)', () => {
      it("lets an Editor or Admin edit anyone's content", async () => {
        stored({ version: 3 });
        await expect(update(editor)).resolves.toBeDefined();

        await expect(update(admin, { title: 'Again' }, 4)).resolves.toBeDefined();
      });

      it("forbids an Author editing another author's content", async () => {
        stored({ version: 3 });

        await expect(update(otherAuthor)).rejects.toThrow(ForbiddenError);
      });

      it.each(['in_review', 'published'] as const)(
        'stops an Author editing their own %s content',
        async (status) => {
          stored({ version: 3, status, ...publishable });

          await expect(update(author)).rejects.toThrow(InvalidTransitionError);
        },
      );

      it('stops an Author changing a scheduled draft, which an Editor approved', async () => {
        stored({ version: 3, scheduledAt: new Date('2026-06-02T00:00:00Z') });

        await expect(update(author)).rejects.toThrow(ContentScheduledError);
        expect(contents.get(ID).title).toBe('A Title');
      });

      it('lets an Editor change a scheduled draft', async () => {
        const scheduledAt = new Date('2026-06-02T00:00:00Z');
        stored({ version: 3, scheduledAt });

        await expect(update(editor)).resolves.toMatchObject({ title: 'New title', scheduledAt });
      });

      it('lets an Editor edit published content, which stays published', async () => {
        stored({ version: 3, status: 'published', ...publishable });

        await expect(update(editor)).resolves.toMatchObject({ status: 'published' });
      });
    });

    it('reports a missing item, and a soft-deleted one the same way', async () => {
      await expect(update(editor)).rejects.toThrow(ContentNotFoundError);

      stored({ version: 3, deletedAt: new Date() });
      await expect(update(editor)).rejects.toThrow(ContentNotFoundError);
    });
  });

  describe('lifecycle actions', () => {
    const moderators = [editor, admin];
    const nonModerators = [author, otherAuthor];

    describe('SubmitContent', () => {
      const submit = (actor: Actor) => new SubmitContent(deps).execute(command(actor));

      it('lets an Author submit their own draft and records it', async () => {
        stored();

        await expect(submit(author)).resolves.toMatchObject({ status: 'in_review', version: 2 });
        expect(audit.actions()).toEqual(['content.submit']);
        expect(events.published).toEqual([]);
        expect(contents.versions[0]).toMatchObject({ versionNo: 2 });
      });

      it("forbids submitting another author's draft", async () => {
        stored();

        await expect(submit(otherAuthor)).rejects.toThrow(ForbiddenError);
      });

      it("lets an Editor submit anyone's draft", async () => {
        stored();

        await expect(submit(editor)).resolves.toMatchObject({ status: 'in_review' });
      });
    });

    describe('PublishContent', () => {
      const publish = (actor: Actor) => new PublishContent(deps).execute(command(actor));

      it.each(moderators)('lets $role publish directly from draft', async (actor) => {
        stored(publishable);

        await expect(publish(actor)).resolves.toMatchObject({ status: 'published' });
      });

      it.each(nonModerators)('forbids $id', async (actor) => {
        stored(publishable);

        await expect(publish(actor)).rejects.toThrow(ForbiddenError);
        expect(contents.get(ID).status).toBe('draft');
      });

      it('audits and publishes an event only after the commit', async () => {
        stored({ ...publishable, slug: 'a-slug' });
        const seenDuringTransaction: number[] = [];
        const run = tx.run.bind(tx);
        tx.run = (work) =>
          run(async () => {
            const result = await work();
            seenDuringTransaction.push(events.published.length);
            return result;
          });

        await publish(editor);

        expect(seenDuringTransaction).toEqual([0]);
        expect(events.published).toEqual([
          { type: 'ContentPublished', contentId: ID, contentType: 'article', slug: 'a-slug' },
        ]);
        expect(audit.actions()).toEqual(['content.publish']);
      });

      it('publishes no event when the transaction fails', async () => {
        stored(publishable);
        contents.failNextSave = new ConcurrentModificationError();

        await expect(publish(editor)).rejects.toThrow(ConcurrentModificationError);
        expect(events.published).toEqual([]);
        expect(audit.events).toEqual([]);
      });

      it('returns 409 for a wrong transition and validation for a missing body', async () => {
        stored({ ...publishable, status: 'archived' });
        await expect(publish(editor)).rejects.toThrow(InvalidTransitionError);

        stored({ status: 'draft' });
        await expect(publish(editor)).rejects.toThrow(MissingRequiredFieldsError);
      });
    });

    describe('RejectContent', () => {
      const reject = (actor: Actor) =>
        new RejectContent(deps).execute({ ...command(actor), note: 'Needs a source' });

      it('returns content to draft with the note for its author', async () => {
        stored({ status: 'in_review' });

        await expect(reject(editor)).resolves.toMatchObject({
          status: 'draft',
          reviewNote: 'Needs a source',
        });
        expect(audit.events[0]).toMatchObject({
          action: 'content.reject',
          summary: { note: 'Needs a source' },
        });
      });

      it('forbids an Author, even on their own content', async () => {
        stored({ status: 'in_review' });

        await expect(reject(author)).rejects.toThrow(ForbiddenError);
      });
    });

    describe('UnpublishContent', () => {
      const unpublish = (actor: Actor) => new UnpublishContent(deps).execute(command(actor));

      it('unpublishes and tells the public side to drop it', async () => {
        stored({ ...publishable, status: 'published', slug: 'gone' });

        await expect(unpublish(editor)).resolves.toMatchObject({ status: 'unpublished' });
        expect(events.published).toEqual([
          { type: 'ContentUnpublished', contentId: ID, contentType: 'article', slug: 'gone' },
        ]);
        expect(audit.actions()).toEqual(['content.unpublish']);
      });

      it('forbids an Author', async () => {
        stored({ ...publishable, status: 'published' });

        await expect(unpublish(author)).rejects.toThrow(ForbiddenError);
      });
    });

    describe('ArchiveContent', () => {
      const archive = (actor: Actor) => new ArchiveContent(deps).execute(command(actor));

      it('archives unpublished content', async () => {
        stored({ status: 'unpublished' });

        await expect(archive(admin)).resolves.toMatchObject({ status: 'archived' });
        expect(audit.actions()).toEqual(['content.archive']);
      });

      it('forbids an Author', async () => {
        stored({ status: 'unpublished' });

        await expect(archive(author)).rejects.toThrow(ForbiddenError);
      });
    });

    describe('ScheduleContent', () => {
      const schedule = (actor: Actor, scheduledAt: Date | null) =>
        new ScheduleContent(deps).execute({ ...command(actor), scheduledAt });
      const future = new Date('2026-06-02T00:00:00Z');

      it('sets the time and audits it (FR-CONTENT-07)', async () => {
        stored({ ...publishable, status: 'in_review' });

        await expect(schedule(editor, future)).resolves.toMatchObject({
          status: 'in_review',
          scheduledAt: future,
        });
        expect(audit.events[0]).toMatchObject({
          action: 'content.schedule',
          summary: { scheduled_at: future.toISOString() },
        });
      });

      it('cancels with null', async () => {
        stored({ ...publishable, scheduledAt: future });

        await expect(schedule(editor, null)).resolves.toMatchObject({ scheduledAt: null });
        expect(audit.actions()).toEqual(['content.schedule_cancel']);
      });

      it('does nothing when cancelling what was never scheduled', async () => {
        stored(publishable);

        await expect(schedule(editor, null)).resolves.toMatchObject({ version: 1 });
        expect(audit.events).toEqual([]);
        expect(contents.versions).toEqual([]);
      });

      it('forbids an Author', async () => {
        stored(publishable);

        await expect(schedule(author, future)).rejects.toThrow(ForbiddenError);
      });
    });

    describe('DeleteContent', () => {
      const remove = (actor: Actor) => new DeleteContent(deps).execute(command(actor));

      it('soft deletes and announces it (FR-CONTENT-13)', async () => {
        stored({ slug: 'bye' });

        await remove(editor);

        expect(contents.get(ID).deletedAt).toEqual(clock.now());
        expect(audit.actions()).toEqual(['content.delete']);
        expect(events.published).toEqual([
          { type: 'ContentDeleted', contentId: ID, contentType: 'article', slug: 'bye' },
        ]);
      });

      it('forbids an Author, even on their own content', async () => {
        stored();

        await expect(remove(author)).rejects.toThrow(ForbiddenError);
      });
    });

    describe('UndoUnpublishContent', () => {
      const undo = (actor: Actor) => new UndoUnpublishContent(deps).execute(command(actor));
      const unpublished = () => {
        stored({
          status: 'unpublished',
          slug: 'live',
          title: 'T',
          body: aTextBody('Text'),
          updatedAt: clock.now(),
        });
      };

      it('publishes again, audits it and clears the public cache', async () => {
        unpublished();

        await expect(undo(editor)).resolves.toMatchObject({ status: 'published' });

        expect(audit.actions()).toEqual(['content.unpublish_undo']);
        expect(events.published).toEqual([
          { type: 'ContentPublished', contentId: ID, contentType: 'article', slug: 'live' },
        ]);
      });

      it('forbids an Author', async () => {
        unpublished();

        await expect(undo(author)).rejects.toThrow(ForbiddenError);
      });
    });

    describe('RestoreContent', () => {
      const restore = (actor: Actor) => new RestoreContent(deps).execute(command(actor));
      const deleted = (overrides: Parameters<typeof stored>[0] = {}) => {
        stored({ deletedAt: clock.now(), slug: 'back', ...overrides });
      };

      it('brings a deleted item back as a new version, and audits it', async () => {
        deleted({ version: 3 });

        const view = await restore(editor);

        expect(view).toMatchObject({ id: ID, slug: 'back', version: 4 });
        expect(contents.get(ID).deletedAt).toBeNull();
        expect(contents.versions[0]).toMatchObject({ versionNo: 4, editorId: editor.id });
        expect(audit.actions()).toEqual(['content.restore']);
        expect(audit.events[0]).toMatchObject({ actorId: editor.id, targetId: ID });
      });

      it('announces published content, since the public cache must learn of it', async () => {
        deleted({ status: 'published' });

        await restore(editor);

        expect(events.published).toEqual([
          { type: 'ContentPublished', contentId: ID, contentType: 'article', slug: 'back' },
        ]);
      });

      it('announces nothing for content that is not public', async () => {
        deleted({ status: 'draft' });

        await restore(editor);

        expect(events.published).toEqual([]);
      });

      it('refuses an item that is not deleted', async () => {
        stored();

        await expect(restore(editor)).rejects.toThrow(ContentNotFoundError);
      });

      it('forbids an Author, before looking anything up', async () => {
        deleted({ authorId: author.id });

        await expect(restore(author)).rejects.toThrow(ForbiddenError);
        expect(contents.get(ID).deletedAt).not.toBeNull();
      });
    });
  });

  describe('GetContent', () => {
    const get = (actor: Actor) => new GetContent(deps).execute({ actor, id: ID });

    it('lets an Author read their own draft, with SEO defaults', async () => {
      stored({ title: 'T', body: aTextBody('Body text') });

      await expect(get(author)).resolves.toMatchObject({
        id: ID,
        effectiveSeo: { title: 'T', description: 'Body text' },
      });
    });

    it("forbids an Author from another author's draft (FR-AUTHZ-02)", async () => {
      stored();

      await expect(get(otherAuthor)).rejects.toThrow(ForbiddenError);
    });

    it('lets an Author read published content by anyone', async () => {
      stored({ ...publishable, status: 'published' });

      await expect(get(otherAuthor)).resolves.toBeDefined();
    });

    it('lets an Editor read any draft', async () => {
      stored();

      await expect(get(editor)).resolves.toBeDefined();
    });

    it('reports a missing item', async () => {
      await expect(get(editor)).rejects.toThrow(ContentNotFoundError);
    });
  });

  describe('ListContent', () => {
    const list = (actor: Actor, filters: object = {}) =>
      new ListContent(deps).execute({ actor, ...filters });

    beforeEach(() => {
      contents.add(aContent({ id: 'a', authorId: author.id, slug: 'a', title: 'Apple' }));
      contents.add(aContent({ id: 'b', authorId: otherAuthor.id, slug: 'b', title: 'Banana' }));
    });

    it('shows an Author only their own, whatever the query asks (FR-AUTHZ-02)', async () => {
      const result = await list(author, { authorId: otherAuthor.id });

      expect(result.items.map((item) => item.id)).toEqual(['a']);
    });

    it('shows an Editor everything and honors the author filter', async () => {
      await expect(list(editor)).resolves.toMatchObject({ total: 2 });
      await expect(list(editor, { authorId: otherAuthor.id })).resolves.toMatchObject({ total: 1 });
    });

    it('sorts by most recently updated unless told otherwise', async () => {
      contents.add(
        aContent({ id: 'c', slug: 'c', title: 'Cherry', updatedAt: new Date('2030-01-01') }),
      );

      const newest = await list(editor);
      const byTitle = await list(editor, { sortBy: 'title', descending: false });

      expect(newest.items[0]?.id).toBe('c');
      expect(byTitle.items.map((item) => item.title)).toEqual(['Apple', 'Banana', 'Cherry']);
    });

    it('applies paging', async () => {
      const result = await list(editor, { page: 2, pageSize: 1 });

      expect(result).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    });
  });

  describe('ContentStats', () => {
    beforeEach(() => {
      contents.add(aContent({ id: 'a', authorId: author.id, slug: 'a' }));
      contents.add(aContent({ id: 'b', authorId: otherAuthor.id, slug: 'b', status: 'in_review' }));
    });

    it("counts only an Author's own", async () => {
      await expect(new ContentStats(deps).execute({ actor: author })).resolves.toMatchObject({
        draft: 1,
        in_review: 0,
      });
    });

    it('counts everything for an Editor', async () => {
      await expect(new ContentStats(deps).execute({ actor: editor })).resolves.toMatchObject({
        draft: 1,
        in_review: 1,
      });
    });
  });

  describe('ReadPublishedContent (FR-PUBAPI-03)', () => {
    const read = () => new ReadPublishedContent(deps);
    const live = {
      status: 'published' as const,
      publishedAt: new Date('2026-05-01'),
      ...publishable,
    };

    it('lists only what is public as of now', async () => {
      contents.add(aContent({ ...live, id: 'yes', slug: 'yes' }));
      contents.add(aContent({ ...live, id: 'draft', slug: 'draft', status: 'draft' }));
      contents.add(
        aContent({ ...live, id: 'future', slug: 'future', publishedAt: new Date('2026-07-01') }),
      );

      const result = await read().list({ type: 'article' }, { page: 1, pageSize: 10 });

      expect(result.items.map((item) => item.id)).toEqual(['yes']);
    });

    it('finds one by slug, with its SEO defaults and author', async () => {
      contents.add(aContent({ ...live, slug: 'yes', title: 'T' }));

      await expect(read().findBySlug('article', 'yes')).resolves.toMatchObject({
        slug: 'yes',
        authorName: 'Name of author-1',
        publishedAt: live.publishedAt,
        effectiveSeo: { title: 'T', description: 'Some text' },
      });
    });

    it('finds nothing for what is not public', async () => {
      contents.add(aContent({ ...live, slug: 'no', status: 'unpublished' }));

      await expect(read().findBySlug('article', 'no')).resolves.toBeNull();
    });

    it('counts only public use of media', async () => {
      contents.add(aContent({ ...live, id: 'a', slug: 'a', featuredImageId: MEDIA }));
      contents.add(
        aContent({ ...live, id: 'b', slug: 'b', status: 'draft', featuredImageId: MEDIA }),
      );

      await expect(read().countMediaUsage(MEDIA)).resolves.toBe(1);
    });
  });

  it('CountMediaUsage counts live content that refers to the media anywhere', async () => {
    const body = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/a', mediaId: MEDIA } }],
    };
    contents.add(aContent({ id: 'a', slug: 'a', featuredImageId: MEDIA }));
    contents.add(aContent({ id: 'b', slug: 'b', socialImageId: MEDIA }));
    contents.add(aContent({ id: 'c', slug: 'c', body }));
    contents.add(aContent({ id: 'd', slug: 'd' }));
    contents.add(aContent({ id: 'e', slug: 'e', featuredImageId: MEDIA, deletedAt: new Date() }));

    await expect(new CountMediaUsage(deps).execute(MEDIA)).resolves.toBe(3);
  });

  it('ContentCategories returns the predefined list', () => {
    expect(new ContentCategories(deps).execute()).toEqual(['news', 'guides']);
  });

  describe('versions', () => {
    const save = (actor: Actor, title: string, version: number) =>
      new UpdateContent(deps).execute({ ...command(actor), title, version });

    beforeEach(async () => {
      stored({ title: 'One', version: 1 });
      await save(author, 'Two', 1);
      await save(author, 'Three', 2);
    });

    it('lists versions, newest first, without snapshots', async () => {
      const result = await new ListContentVersions(deps).execute({ actor: author, id: ID });

      expect(result.items.map((v) => v.versionNo)).toEqual([3, 2]);
    });

    it('keeps only the last 50 (02-SRS 6.4)', async () => {
      for (let version = 3; version < 55; version += 1) {
        await save(editor, `Title ${String(version)}`, version);
      }

      const result = await new ListContentVersions(deps).execute({ actor: editor, id: ID });
      expect(result.total).toBe(50);
    });

    it('returns one version with its snapshot', async () => {
      const version = await new GetContentVersion(deps).execute({
        actor: author,
        id: ID,
        versionNo: 2,
      });

      expect(version.snapshot.title).toBe('Two');
    });

    it('reports a version that does not exist', async () => {
      await expect(
        new GetContentVersion(deps).execute({ actor: author, id: ID, versionNo: 99 }),
      ).rejects.toThrow(ContentNotFoundError);
    });

    it('hides history from another Author even when the item is published', async () => {
      contents.add(aContent({ ...contents.get(ID), ...publishable, status: 'published' }));

      await expect(
        new ListContentVersions(deps).execute({ actor: otherAuthor, id: ID }),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        new GetContentVersion(deps).execute({ actor: otherAuthor, id: ID, versionNo: 2 }),
      ).rejects.toThrow(ForbiddenError);
    });

    describe('RevertContent (FR-CONTENT-09)', () => {
      const revert = (actor: Actor, versionNo: number) =>
        new RevertContent(deps).execute({ ...command(actor), versionNo });

      it('restores the fields as a new version, destroying nothing', async () => {
        await expect(revert(author, 2)).resolves.toMatchObject({ title: 'Two', version: 4 });

        expect(contents.versions.map((v) => v.versionNo)).toEqual([2, 3, 4]);
        expect(audit.events.at(-1)).toMatchObject({ action: 'content.revert' });
        expect(audit.events.at(-1)?.summary).toEqual({ to_version: 2 });
      });

      it('applies the same rules as editing', async () => {
        await expect(revert(otherAuthor, 2)).rejects.toThrow(ForbiddenError);

        contents.add(aContent({ ...contents.get(ID), ...publishable, status: 'in_review' }));
        await expect(revert(author, 2)).rejects.toThrow(InvalidTransitionError);
      });

      it('restores what it can when media in that version has since been deleted', async () => {
        const body = {
          type: 'doc',
          content: [
            { type: 'image', attrs: { src: '/gone', mediaId: GONE } },
            { type: 'image', attrs: { src: '/kept', mediaId: MEDIA } },
          ],
        };
        await save(author, 'Four', 3);
        contents.add(aContent({ ...contents.get(ID), featuredImageId: null }));
        const version = contents.versions.find((v) => v.versionNo === 4);
        if (!version) throw new Error('no version 4');
        contents.versions[contents.versions.indexOf(version)] = {
          ...version,
          snapshot: { ...version.snapshot, body, featuredImageId: GONE, socialImageId: MEDIA },
        };

        const view = await revert(author, 4);

        expect(view).toMatchObject({ featuredImageId: null, socialImageId: MEDIA });
        expect(view.body.content?.map((node) => node.attrs?.['mediaId'])).toEqual([MEDIA]);
        expect(audit.events.at(-1)?.summary).toEqual({ to_version: 4, dropped_media: [GONE] });
      });

      it('stops an Author reverting a scheduled draft', async () => {
        contents.add(aContent({ ...contents.get(ID), scheduledAt: new Date('2026-06-02') }));

        await expect(revert(author, 2)).rejects.toThrow(ContentScheduledError);
      });

      it('reports a version that does not exist', async () => {
        await expect(revert(author, 99)).rejects.toThrow(ContentNotFoundError);
      });

      it('leaves lifecycle state alone', async () => {
        await new UpdateContent(deps).execute({
          ...command(editor),
          version: 3,
          body: aTextBody('Text'),
        });
        contents.add(aContent({ ...contents.get(ID), status: 'published' }));
        await save(editor, 'Later', 4);

        await expect(revert(editor, 4)).resolves.toMatchObject({
          status: 'published',
          title: 'Three',
        });
      });
    });
  });

  describe('PublishDueContent (FR-CONTENT-07)', () => {
    const run = () => new PublishDueContent(deps).execute();
    const due = (overrides: Parameters<typeof aContent>[0] = {}) =>
      stored({ ...publishable, status: 'in_review', scheduledAt: clock.now(), ...overrides });

    it('publishes what is due, attributed to no user', async () => {
      due({ slug: 'due' });

      await expect(run()).resolves.toBe(1);

      expect(contents.get(ID)).toMatchObject({ status: 'published', scheduledAt: null });
      expect(contents.versions[0]).toMatchObject({ editorId: null });
      expect(audit.events[0]).toMatchObject({
        actorId: null,
        actorIp: null,
        action: 'content.publish',
        summary: { scheduled: true },
      });
      expect(events.published).toEqual([
        { type: 'ContentPublished', contentId: ID, contentType: 'article', slug: 'due' },
      ]);
    });

    it('leaves what is not due yet', async () => {
      due({ scheduledAt: new Date(clock.now().getTime() + 1000) });

      await expect(run()).resolves.toBe(0);
      expect(contents.get(ID).status).toBe('in_review');
    });

    it('clears the schedule and audits it when the item can no longer publish', async () => {
      due({ body: aTextBody('') });

      await expect(run()).resolves.toBe(0);

      expect(contents.get(ID)).toMatchObject({ status: 'in_review', scheduledAt: null });
      expect(audit.events[0]).toMatchObject({
        actorId: null,
        action: 'content.schedule_failed',
        summary: { code: 'MISSING_REQUIRED_FIELDS' },
      });
      expect(events.published).toEqual([]);
    });

    it('ends the schedule of an item that moved to a state that cannot publish', async () => {
      due({ status: 'archived' });

      await expect(run()).resolves.toBe(0);

      expect(contents.get(ID).scheduledAt).toBeNull();
      expect(audit.events[0]).toMatchObject({
        action: 'content.schedule_failed',
        summary: { code: 'INVALID_TRANSITION', details: { from: 'archived', to: 'published' } },
      });
    });

    it('treats any other failure while publishing as unexpected', async () => {
      due();
      const spy = vi.spyOn(Content.prototype, 'publish').mockImplementation(() => {
        throw new Error('a bug');
      });

      await expect(run()).resolves.toBe(0);
      spy.mockRestore();

      expect(contents.get(ID).scheduledAt).not.toBeNull();
      expect(logger.errors[0]?.context).toMatchObject({ contentId: ID, error: 'a bug' });
    });

    it('logs a failure that is not even an Error', async () => {
      due();
      contents.failNextSave = 'odd' as unknown as Error;

      await expect(run()).resolves.toBe(0);

      expect(logger.errors[0]?.context).toMatchObject({ error: 'odd' });
    });

    it('stays quiet when it merely loses a race', async () => {
      due();
      contents.failNextSave = new ConcurrentModificationError();

      await expect(run()).resolves.toBe(0);

      expect(logger.errors).toEqual([]);
    });

    it('carries on with the rest when one item loses a race, and retries it later', async () => {
      due({ id: 'first', slug: 'first' });
      due({ id: 'second', slug: 'second' });
      contents.failNextSave = new ConcurrentModificationError();

      await expect(run()).resolves.toBe(1);

      expect(contents.get('first').status).toBe('in_review');
      expect(contents.get('first').scheduledAt).not.toBeNull();
      expect(contents.get('second').status).toBe('published');
      await expect(run()).resolves.toBe(1);
    });

    it('logs an unexpected failure and carries on', async () => {
      due({ id: 'first', slug: 'first' });
      due({ id: 'second', slug: 'second' });
      contents.failNextSave = new Error('database went away');

      await expect(run()).resolves.toBe(1);

      expect(logger.errors[0]).toMatchObject({
        message: 'Scheduled publish failed',
        context: { contentId: 'first', error: 'database went away' },
      });
    });

    it('skips an item that changed after it was found', async () => {
      due();
      const find = contents.findById.bind(contents);
      contents.findById = async (id) => {
        const content = await find(id);
        return content && aContent({ ...content, scheduledAt: null });
      };

      await expect(run()).resolves.toBe(0);
      expect(contents.get(ID).status).toBe('in_review');
    });

    it('skips an item deleted after it was found', async () => {
      due();
      contents.findById = () => Promise.resolve(null);

      await expect(run()).resolves.toBe(0);
    });
  });

  describe('PurgeDeletedContent (FR-CONTENT-13)', () => {
    const run = () => new PurgeDeletedContent(deps).execute();

    it('hard deletes only what has been deleted for over 30 days, and audits the count', async () => {
      const now = clock.now().getTime();
      contents.add(aContent({ id: 'old', slug: 'old', deletedAt: new Date(now - 31 * DAY_MS) }));
      contents.add(aContent({ id: 'new', slug: 'new', deletedAt: new Date(now - 29 * DAY_MS) }));

      await expect(run()).resolves.toBe(1);

      expect(contents.contents.has('old')).toBe(false);
      expect(contents.contents.has('new')).toBe(true);
      expect(audit.events[0]).toMatchObject({
        actorId: null,
        action: 'content.purge',
        targetType: 'content',
        targetId: null,
        summary: { count: 1, ids: ['old'] },
      });
    });

    it('works through a large backlog in batches, naming what each one removed', async () => {
      const old = new Date(clock.now().getTime() - 31 * DAY_MS);
      for (let n = 0; n < 201; n += 1) {
        contents.add(aContent({ id: `old-${String(n)}`, slug: `s-${String(n)}`, deletedAt: old }));
      }

      await expect(run()).resolves.toBe(201);

      expect(contents.contents.size).toBe(0);
      expect(audit.events.map((event) => event.summary['count'])).toEqual([100, 100, 1]);
      expect(tx.runs).toBe(3);
    });

    it('stops once a batch comes back exactly empty after a full one', async () => {
      const old = new Date(clock.now().getTime() - 31 * DAY_MS);
      for (let n = 0; n < 100; n += 1) {
        contents.add(aContent({ id: `old-${String(n)}`, slug: `s-${String(n)}`, deletedAt: old }));
      }

      await expect(run()).resolves.toBe(100);

      expect(audit.events).toHaveLength(1);
      expect(tx.runs).toBe(2);
    });

    it('audits nothing when there was nothing to purge', async () => {
      await expect(run()).resolves.toBe(0);
      expect(audit.events).toEqual([]);
    });
  });
});
