import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  AccessTokenGuard,
  ClientIp,
  CurrentActor,
  RequireRoles,
  RolesGuard,
} from '../../../../../shared/adapters/http/authentication.js';
import {
  pageOptions,
  pageQuery,
  toListResponse,
} from '../../../../../shared/adapters/http/pagination.js';
import { parseId, parseInput } from '../../../../../shared/adapters/http/validation.js';
import type { Actor } from '../../../../../shared/kernel/actor.js';
import { defined } from '../../../../../shared/kernel/defined.js';
import type {
  ContentFieldsPatch,
  ContentListItem,
  ContentSnapshot,
  ContentVersionDetail,
  ContentVersionSummary,
  ContentView,
  ListContentCommand,
} from '../../../application/ports/in/content.ports.js';
import { CONTENT_USE_CASES, type ContentUseCases } from './content.use-cases.js';

// Lengths are the domain's to judge. These bounds only stop absurd input reaching it.
const text = z.string().max(4096);
const optionalText = text.nullable().optional();
const optionalId = z.uuid().nullable().optional();
const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
// PostgreSQL refuses NUL in a query parameter, which would otherwise surface as a 500.
const filterText = z
  .string()
  .max(200)
  .regex(/^[^\0]*$/);

const editableFields = {
  slug: text.optional(),
  body: z.unknown().optional(),
  featured_image_id: optionalId,
  social_image_id: optionalId,
  seo_title: optionalText,
  seo_description: optionalText,
  tags: z.array(text).max(1000).optional(),
  category: optionalText,
  parent_id: optionalId,
};
const createRequest = z.object({
  type: z.enum(['article', 'page']),
  title: text,
  ...editableFields,
});
const updateRequest = z.object({
  title: text.optional(),
  version: z.number().int().positive(),
  ...editableFields,
});
const rejectRequest = z.object({ note: text.default('') });
const scheduleRequest = z.object({ scheduled_at: instant.nullable() });
const versionParam = z.object({ version: z.coerce.number().int().positive().max(2_000_000_000) });
const listQuery = pageQuery.extend({
  status: z.enum(['draft', 'in_review', 'published', 'unpublished', 'archived']).optional(),
  type: z.enum(['article', 'page']).optional(),
  author_id: z.uuid().optional(),
  // Stored tags are lowercase, so a filter must be too or "News" would match nothing.
  tag: filterText.transform((value) => value.trim().toLowerCase()).optional(),
  from: instant.optional(),
  to: instant.optional(),
  search: filterText.optional(),
  sort: z
    .enum(['updated_at', '-updated_at', 'created_at', '-created_at', 'title', '-title'])
    .optional(),
});

function toFields(input: z.output<typeof updateRequest> | z.output<typeof createRequest>) {
  return defined({
    slug: input.slug,
    body: input.body,
    featuredImageId: input.featured_image_id,
    socialImageId: input.social_image_id,
    seoTitle: input.seo_title,
    seoDescription: input.seo_description,
    tags: input.tags,
    category: input.category,
    parentId: input.parent_id,
  }) satisfies ContentFieldsPatch;
}

function toSort(sort: z.output<typeof listQuery>['sort']) {
  if (sort === undefined) return {};
  const descending = sort.startsWith('-');
  const sortBy = (descending ? sort.slice(1) : sort) as NonNullable<ListContentCommand['sortBy']>;
  return { sortBy, descending };
}

function toFilters(query: z.output<typeof listQuery>) {
  return {
    ...defined({
      status: query.status,
      type: query.type,
      authorId: query.author_id,
      tag: query.tag,
      updatedFrom: query.from,
      updatedTo: query.to,
      search: query.search,
    }),
    ...toSort(query.sort),
    ...pageOptions(query),
  };
}

function snapshotFields(content: ContentSnapshot) {
  return {
    title: content.title,
    slug: content.slug,
    body: content.body,
    status: content.status,
    featured_image_id: content.featuredImageId,
    social_image_id: content.socialImageId,
    seo_title: content.seoTitle,
    seo_description: content.seoDescription,
    tags: content.tags,
    category: content.category,
    parent_id: content.parentId,
  };
}

function toResponse(content: ContentView) {
  return {
    id: content.id,
    type: content.type,
    ...snapshotFields(content),
    effective_seo: content.effectiveSeo,
    author_id: content.authorId,
    scheduled_at: content.scheduledAt,
    published_at: content.publishedAt,
    review_note: content.reviewNote,
    version: content.version,
    created_at: content.createdAt,
    updated_at: content.updatedAt,
  };
}

function toListItem(item: ContentListItem) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    slug: item.slug,
    status: item.status,
    author_id: item.authorId,
    author_name: item.authorName,
    tags: item.tags,
    category: item.category,
    scheduled_at: item.scheduledAt,
    published_at: item.publishedAt,
    version: item.version,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function toVersionSummary(version: ContentVersionSummary) {
  return {
    id: version.id,
    version_no: version.versionNo,
    editor_id: version.editorId,
    created_at: version.createdAt,
  };
}

function toVersionDetail(version: ContentVersionDetail) {
  return { ...toVersionSummary(version), snapshot: snapshotFields(version.snapshot) };
}

const toData = (content: ContentView) => ({ data: toResponse(content) });

@Controller('api/admin/content')
@UseGuards(AccessTokenGuard, RolesGuard)
export class ContentController {
  constructor(@Inject(CONTENT_USE_CASES) private readonly useCases: ContentUseCases) {}

  @Get()
  async list(@Query() query: unknown, @CurrentActor() actor: Actor) {
    const filters = toFilters(parseInput(listQuery, query));
    const result = await this.useCases.list.execute({ actor, ...filters });
    return toListResponse(result, toListItem);
  }

  @Post()
  async create(@Body() body: unknown, @CurrentActor() actor: Actor, @ClientIp() ip: string | null) {
    const input = parseInput(createRequest, body);
    const content = await this.useCases.create.execute({
      actor,
      ip,
      type: input.type,
      title: input.title,
      ...toFields(input),
    });
    return toData(content);
  }

  // Declared before :id, which would otherwise claim these paths.
  @Get('stats')
  async stats(@CurrentActor() actor: Actor) {
    return { data: await this.useCases.stats.execute({ actor }) };
  }

  @Get('categories')
  categories() {
    return { data: this.useCases.categories.execute() };
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentActor() actor: Actor) {
    return toData(await this.useCases.get.execute({ actor, id: parseId(id) }));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    const input = parseInput(updateRequest, body);
    const content = await this.useCases.update.execute({
      actor,
      ip,
      id: parseId(id),
      version: input.version,
      ...defined({ title: input.title }),
      ...toFields(input),
    });
    return toData(content);
  }

  @Delete(':id')
  @RequireRoles('admin', 'editor')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.useCases.remove.execute({ actor, ip, id: parseId(id) });
  }

  @Post(':id/submit')
  @HttpCode(200)
  async submit(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    return toData(await this.useCases.submit.execute({ actor, ip, id: parseId(id) }));
  }

  @Post(':id/publish')
  @RequireRoles('admin', 'editor')
  @HttpCode(200)
  async publish(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    return toData(await this.useCases.publish.execute({ actor, ip, id: parseId(id) }));
  }

  @Post(':id/reject')
  @RequireRoles('admin', 'editor')
  @HttpCode(200)
  async reject(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    const { note } = parseInput(rejectRequest, body);
    return toData(await this.useCases.reject.execute({ actor, ip, id: parseId(id), note }));
  }

  @Post(':id/unpublish')
  @RequireRoles('admin', 'editor')
  @HttpCode(200)
  async unpublish(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    return toData(await this.useCases.unpublish.execute({ actor, ip, id: parseId(id) }));
  }

  @Post(':id/archive')
  @RequireRoles('admin', 'editor')
  @HttpCode(200)
  async archive(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    return toData(await this.useCases.archive.execute({ actor, ip, id: parseId(id) }));
  }

  @Post(':id/schedule')
  @RequireRoles('admin', 'editor')
  @HttpCode(200)
  async schedule(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    const input = parseInput(scheduleRequest, body);
    const content = await this.useCases.schedule.execute({
      actor,
      ip,
      id: parseId(id),
      scheduledAt: input.scheduled_at,
    });
    return toData(content);
  }

  @Get(':id/versions')
  async versions(@Param('id') id: string, @Query() query: unknown, @CurrentActor() actor: Actor) {
    const options = pageOptions(parseInput(pageQuery, query));
    const result = await this.useCases.versions.execute({ actor, id: parseId(id), ...options });
    return toListResponse(result, toVersionSummary);
  }

  @Get(':id/versions/:version')
  async version(
    @Param('id') id: string,
    @Param('version') version: string,
    @CurrentActor() actor: Actor,
  ) {
    const versionNo = parseInput(versionParam, { version }).version;
    const detail = await this.useCases.version.execute({ actor, id: parseId(id), versionNo });
    return { data: toVersionDetail(detail) };
  }

  @Post(':id/revert/:version')
  @HttpCode(200)
  async revert(
    @Param('id') id: string,
    @Param('version') version: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    const versionNo = parseInput(versionParam, { version }).version;
    return toData(await this.useCases.revert.execute({ actor, ip, id: parseId(id), versionNo }));
  }
}
