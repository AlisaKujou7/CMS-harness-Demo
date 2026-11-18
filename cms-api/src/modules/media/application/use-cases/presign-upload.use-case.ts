import { FileTooLargeError, InvalidMediaError } from '../../domain/errors/media.errors.js';
import {
  assertAllowedType,
  extensionOf,
  normalizeFilename,
  toUploadKey,
} from '../../domain/services/media-types.js';
import type { MediaDeps } from '../media-deps.js';
import type {
  PresignedUpload,
  PresignUploadCommand,
  PresignUploadUseCase,
} from '../ports/in/media.ports.js';

// FR-MEDIA-04: the file goes straight to storage, into an area it only leaves once it is checked.
export class PresignUpload implements PresignUploadUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(command: PresignUploadCommand): Promise<PresignedUpload> {
    const { actor, mimeType, sizeBytes } = command;
    const { maxUploadBytes, uploadUrlTtlSeconds } = this.deps.mediaConfig;
    const extension = extensionOf(normalizeFilename(command.filename));
    assertAllowedType(mimeType, extension);
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1) {
      throw new InvalidMediaError('size_bytes', 'Size must be a positive whole number');
    }
    if (sizeBytes > maxUploadBytes) throw new FileTooLargeError(maxUploadBytes);

    const storageKey = toUploadKey({
      ownerId: actor.id,
      uploadId: this.deps.ids.next(),
      extension,
    });
    const uploadUrl = await this.deps.storage.uploadUrl({
      key: storageKey,
      contentType: mimeType,
      contentLength: sizeBytes,
      expiresInSeconds: uploadUrlTtlSeconds,
    });
    return {
      uploadUrl,
      storageKey,
      expiresInSeconds: uploadUrlTtlSeconds,
      headers: { 'Content-Type': mimeType },
    };
  }
}
