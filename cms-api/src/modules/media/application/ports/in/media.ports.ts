import type { Actor } from '../../../../../shared/kernel/actor.js';
import type { PagedResult } from '../../../../../shared/kernel/paged-result.js';
import type { VariantStatus } from '../../../domain/entities/media-item.entity.js';
import type { MediaCriteria } from '../out/media-repository.port.js';

export interface MediaVariantView {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

export interface MediaView {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly url: string;
  readonly variants: Readonly<Record<string, MediaVariantView>>;
  readonly variantStatus: VariantStatus;
  readonly uploadedBy: string;
  readonly uploaderName: string | null;
  readonly createdAt: Date;
}

export interface MediaDetailView extends MediaView {
  readonly usageCount: number;
}

export interface MediaCommand {
  readonly actor: Actor;
  readonly id: string;
  readonly ip: string | null;
}

export interface PresignUploadCommand {
  readonly actor: Actor;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface PresignedUpload {
  readonly uploadUrl: string;
  readonly storageKey: string;
  readonly expiresInSeconds: number;
  // The upload is refused unless it sends exactly these, because they are part of the signature.
  readonly headers: Readonly<Record<string, string>>;
}

export interface FinalizeMediaCommand {
  readonly actor: Actor;
  readonly ip: string | null;
  readonly storageKey: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly altText?: string | null;
  readonly caption?: string | null;
}

export interface UpdateMediaCommand extends MediaCommand {
  readonly altText?: string | null;
  readonly caption?: string | null;
}

export interface PresignUploadUseCase {
  execute(command: PresignUploadCommand): Promise<PresignedUpload>;
}

export interface FinalizeMediaUseCase {
  execute(command: FinalizeMediaCommand): Promise<MediaView>;
}

export interface UpdateMediaUseCase {
  execute(command: UpdateMediaCommand): Promise<MediaView>;
}

export interface DeleteMediaUseCase {
  execute(command: MediaCommand & { readonly force: boolean }): Promise<void>;
}

export interface GetMediaUseCase {
  execute(command: { readonly id: string }): Promise<MediaDetailView>;
}

export interface ListMediaUseCase {
  execute(
    command: MediaCriteria & { readonly page?: number; readonly pageSize?: number },
  ): Promise<PagedResult<MediaView>>;
}

export interface FindMissingMediaUseCase {
  execute(ids: readonly string[]): Promise<readonly string[]>;
}

export interface GenerateMediaVariantsUseCase {
  execute(mediaId: string): Promise<void>;
}

export interface EnqueueMissingVariantsUseCase {
  execute(): Promise<number>;
}

export interface PurgeAbandonedUploadsUseCase {
  execute(): Promise<number>;
}
