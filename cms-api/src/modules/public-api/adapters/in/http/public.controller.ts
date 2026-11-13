import { createHash } from 'node:crypto';
import { Controller, Get, Inject, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { pageOptions, pageQuery } from '../../../../../shared/adapters/http/pagination.js';
import { HTTP_CONFIG, type HttpConfig } from '../../../../../shared/adapters/http/tokens.js';
import { filterText, parseId, parseInput } from '../../../../../shared/adapters/http/validation.js';
import { defined } from '../../../../../shared/kernel/defined.js';
import type {
  PublicContentDetail,
  PublicContentList,
  PublicContentSummary,
  PublicMedia,
  PublicResponse,
} from '../../../application/ports/in/public-api.ports.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { PUBLIC_API_USE_CASES, type PublicApiUseCases } from './public-api.use-cases.js';

export const articleListQuery = pageQuery.extend({
  // Stored tags are lowercase, so a filter must be too or "News" would match nothing.
  tag: filterText.transform((value) => value.trim().toLowerCase()).optional(),
  category: filterText.optional(),
});

function toMediaResponse(media: PublicMedia) {
  return {
    id: media.id,
    filename: media.filename,
    mime_type: media.mimeType,
    size_bytes: media.sizeBytes,
    width: media.width,
    height: media.height,
    alt_text: media.altText,
    caption: media.caption,
    url: media.url,
    variants: media.variants,
  };
}

function commonFields(item: PublicContentSummary) {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    featured_image: item.featuredImage && toMediaResponse(item.featuredImage),
    published_at: item.publishedAt,
    updated_at: item.updatedAt,
  };
}

// 01-Requirements 6.2: a page has no author display, tags or category.
function toArticle(item: PublicContentSummary) {
  return {
    ...commonFields(item),
    author_name: item.authorName,
    tags: item.tags,
    category: item.category,
  };
}

function toPage(item: PublicContentSummary) {
  return { ...commonFields(item), parent: item.parent };
}

function detailFields(item: PublicContentDetail) {
  return {
    body: item.body,
    seo: {
      title: item.seo.title,
      description: item.seo.description,
      social_image: item.seo.socialImage && toMediaResponse(item.seo.socialImage),
    },
  };
}

function toListBody<R>(list: PublicContentList, toItem: (item: PublicContentSummary) => R) {
  const { page, pageSize, total, totalPages } = list.pagination;
  return {
    data: list.items.map(toItem),
    pagination: { page, page_size: pageSize, total, total_pages: totalPages },
  };
}

// FR-PUBAPI-01: read-only, so this controller has only GET routes.
@Controller('api/v1')
@UseGuards(ApiKeyGuard)
export class PublicController {
  constructor(
    @Inject(PUBLIC_API_USE_CASES) private readonly useCases: PublicApiUseCases,
    @Inject(HTTP_CONFIG) private readonly config: HttpConfig,
  ) {}

  // FR-PUBAPI-04. Express answers 304 by itself when these match the request's validators. Private
  // because a response depends on holding a key, so a shared cache must not reuse it.
  private withCacheHeaders<T, B>(response: Response, result: PublicResponse<T>, body: B): B {
    // A date cannot say when this changed: removing an item moves a list's date backwards, and
    // signed URLs change with no date at all. Only the ETag can decide, so the date is ignored,
    // which HTTP allows, and such a client simply gets the full response.
    Reflect.deleteProperty(response.req.headers, 'if-modified-since');
    const etag = createHash('sha256').update(result.cacheTag).digest('base64url');
    response.setHeader('ETag', `"${etag}"`);
    response.setHeader('Last-Modified', result.lastModified);
    response.setHeader(
      'Cache-Control',
      `private, max-age=${String(this.config.publicCacheSeconds)}`,
    );
    response.vary('X-API-Key');
    return body;
  }

  @Get('articles')
  async articles(@Query() query: unknown, @Res({ passthrough: true }) response: Response) {
    const input = parseInput(articleListQuery, query);
    const result = await this.useCases.list.execute({
      type: 'article',
      ...pageOptions(input),
      ...defined({ tag: input.tag, category: input.category }),
    });
    return this.withCacheHeaders(response, result, toListBody(result.data, toArticle));
  }

  @Get('articles/:slug')
  async article(@Param('slug') slug: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.useCases.get.execute({ type: 'article', slug });
    return this.withCacheHeaders(response, result, {
      data: { ...toArticle(result.data), ...detailFields(result.data) },
    });
  }

  @Get('pages')
  async pages(@Query() query: unknown, @Res({ passthrough: true }) response: Response) {
    const options = pageOptions(parseInput(pageQuery, query));
    const result = await this.useCases.list.execute({ type: 'page', ...options });
    return this.withCacheHeaders(response, result, toListBody(result.data, toPage));
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.useCases.get.execute({ type: 'page', slug });
    return this.withCacheHeaders(response, result, {
      data: { ...toPage(result.data), ...detailFields(result.data) },
    });
  }

  @Get('media/:id')
  async media(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.useCases.media.execute({ id: parseId(id) });
    return this.withCacheHeaders(response, result, { data: toMediaResponse(result.data) });
  }
}
