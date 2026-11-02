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
} from '../../../../../shared/adapters/http/authentication.js';
import {
  pageOptions,
  pageQuery,
  toListResponse,
} from '../../../../../shared/adapters/http/pagination.js';
import {
  filterText,
  instant,
  parseId,
  parseInput,
} from '../../../../../shared/adapters/http/validation.js';
import type { Actor } from '../../../../../shared/kernel/actor.js';
import { defined } from '../../../../../shared/kernel/defined.js';
import type { MediaDetailView, MediaView } from '../../../application/ports/in/media.ports.js';
import { MEDIA_USE_CASES, type MediaUseCases } from './media.use-cases.js';

const text = z.string().max(4096);
const optionalText = text.nullable().optional();
export const presignMediaRequest = z.object({
  filename: text,
  mime_type: text,
  size_bytes: z.number(),
});
export const finalizeMediaRequest = z.object({
  storage_key: text,
  filename: text,
  mime_type: text,
  alt_text: optionalText,
  caption: optionalText,
});
export const updateMediaRequest = z.object({ alt_text: optionalText, caption: optionalText });
export const mediaDeleteQuery = z.object({ force: z.enum(['true', 'false']).optional() });
export const mediaListQuery = pageQuery.extend({
  search: filterText.optional(),
  uploaded_by: z.uuid().optional(),
  kind: z.enum(['image', 'document']).optional(),
  from: instant.optional(),
  to: instant.optional(),
});

function toResponse(media: MediaView) {
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
    variant_status: media.variantStatus,
    uploaded_by: media.uploadedBy,
    uploader_name: media.uploaderName,
    created_at: media.createdAt,
  };
}

function toDetailResponse(media: MediaDetailView) {
  return { ...toResponse(media), usage_count: media.usageCount };
}

@Controller('api/admin/media')
@UseGuards(AccessTokenGuard)
export class MediaController {
  constructor(@Inject(MEDIA_USE_CASES) private readonly useCases: MediaUseCases) {}

  @Post('presign')
  @HttpCode(200)
  async presign(@Body() body: unknown, @CurrentActor() actor: Actor) {
    const input = parseInput(presignMediaRequest, body);
    const upload = await this.useCases.presign.execute({
      actor,
      filename: input.filename,
      mimeType: input.mime_type,
      sizeBytes: input.size_bytes,
    });
    return {
      data: {
        upload_url: upload.uploadUrl,
        storage_key: upload.storageKey,
        expires_in: upload.expiresInSeconds,
        headers: upload.headers,
      },
    };
  }

  @Post()
  async finalize(
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    const input = parseInput(finalizeMediaRequest, body);
    const media = await this.useCases.finalize.execute({
      actor,
      ip,
      storageKey: input.storage_key,
      filename: input.filename,
      mimeType: input.mime_type,
      ...defined({ altText: input.alt_text, caption: input.caption }),
    });
    return { data: toResponse(media) };
  }

  @Get()
  async list(@Query() query: unknown) {
    const input = parseInput(mediaListQuery, query);
    const result = await this.useCases.list.execute({
      ...pageOptions(input),
      ...defined({
        search: input.search,
        uploadedBy: input.uploaded_by,
        kind: input.kind,
        from: input.from,
        to: input.to,
      }),
    });
    return toListResponse(result, toResponse);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return { data: toDetailResponse(await this.useCases.get.execute({ id: parseId(id) })) };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    const input = parseInput(updateMediaRequest, body);
    const media = await this.useCases.update.execute({
      actor,
      ip,
      id: parseId(id),
      ...defined({ altText: input.alt_text, caption: input.caption }),
    });
    return { data: toResponse(media) };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @Query() query: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    const { force } = parseInput(mediaDeleteQuery, query);
    await this.useCases.remove.execute({ actor, ip, id: parseId(id), force: force === 'true' });
  }
}
