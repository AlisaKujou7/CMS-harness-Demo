import { ForbiddenError, AppError } from '../../../../shared/kernel/app-error.js';
import { MediaItem } from '../../domain/entities/media-item.entity.js';
import {
  FileTooLargeError,
  MediaAlreadyExistsError,
  UnsupportedMediaTypeError,
  UploadChangedError,
  UploadNotFoundError,
} from '../../domain/errors/media.errors.js';
import type { MediaUploaded } from '../../domain/events/media.events.js';
import {
  assertAllowedType,
  detectMimeType,
  extensionOf,
  normalizeFilename,
  originalKey,
  parseUploadKey,
  SIGNATURE_BYTES,
  SVG_MIME,
} from '../../domain/services/media-types.js';
import type { MediaDeps } from '../media-deps.js';
import type {
  FinalizeMediaCommand,
  FinalizeMediaUseCase,
  MediaView,
} from '../ports/in/media.ports.js';
import type { StoredObject } from '../ports/out/media-services.port.js';
import { toMediaView } from '../services/media-helpers.js';

// Sanitizing parses the whole document, so an SVG gets a limit far below other files.
const MAX_SVG_BYTES = 5 * 1024 * 1024;

interface CheckedUpload {
  readonly command: FinalizeMediaCommand;
  readonly pendingKey: string;
  readonly mediaId: string;
  readonly extension: string;
  readonly filename: string;
}

// FR-MEDIA-03 and SEC-05. Nothing trusts what the upload claims: the stored type, the extension and
// the bytes must agree. The file then moves out of the writable area, conditional on its version,
// so a second PUT to the same presigned URL cannot swap in something that was never checked.
export class FinalizeMedia implements FinalizeMediaUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(command: FinalizeMediaCommand): Promise<MediaView> {
    const upload = parseUploadKey(command.storageKey);
    if (upload.ownerId !== command.actor.id) throw new ForbiddenError();
    const filename = normalizeFilename(command.filename);
    const checked: CheckedUpload = {
      command,
      pendingKey: command.storageKey,
      mediaId: upload.uploadId,
      extension: upload.extension,
      filename,
    };

    const stored = await this.deps.storage.head(checked.pendingKey);
    if (!stored) throw new UploadNotFoundError();

    let finalSize: number;
    try {
      await this.assertMatches(checked, stored);
      finalSize = await this.moveIntoPlace(checked, stored);
    } catch (error) {
      await this.refuse(checked, error);
      throw error;
    }
    return this.record(checked, finalSize);
  }

  private async assertMatches(checked: CheckedUpload, stored: StoredObject): Promise<void> {
    const { mimeType } = checked.command;
    const { maxUploadBytes } = this.deps.mediaConfig;
    assertAllowedType(mimeType, extensionOf(checked.filename));
    if (extensionOf(checked.filename) !== checked.extension) {
      throw new UnsupportedMediaTypeError('the extension does not match what was uploaded');
    }
    if (stored.contentType !== mimeType) {
      throw new UnsupportedMediaTypeError('the stored type does not match what was declared');
    }
    if (stored.size > maxUploadBytes) throw new FileTooLargeError(maxUploadBytes);

    const start = await this.deps.storage.read(checked.pendingKey, {
      etag: stored.etag,
      maxBytes: SIGNATURE_BYTES,
    });
    if (!start) throw new UploadChangedError();
    if (detectMimeType(start) !== mimeType) {
      throw new UnsupportedMediaTypeError('the file content does not match its type');
    }
  }

  private async moveIntoPlace(checked: CheckedUpload, stored: StoredObject): Promise<number> {
    const { storage } = this.deps;
    const target = originalKey(checked.mediaId, checked.extension);
    let size = stored.size;
    if (checked.command.mimeType === SVG_MIME) {
      const clean = await this.sanitizedSvg(checked.pendingKey, stored);
      await storage.put(target, clean, SVG_MIME);
      size = clean.length;
    } else if (!(await storage.copyIfUnchanged(checked.pendingKey, target, stored.etag))) {
      throw new UploadChangedError();
    }
    await storage.delete([checked.pendingKey]);
    return size;
  }

  private async sanitizedSvg(key: string, stored: StoredObject): Promise<Uint8Array> {
    if (stored.size > MAX_SVG_BYTES) throw new FileTooLargeError(MAX_SVG_BYTES);
    const bytes = await this.deps.storage.read(key, {
      etag: stored.etag,
      maxBytes: MAX_SVG_BYTES,
    });
    if (!bytes) throw new UploadChangedError();
    const clean = this.deps.svg.sanitize(bytes);
    if (!clean) throw new UnsupportedMediaTypeError('the file is not a well-formed SVG');
    return clean;
  }

  // A refused file is removed at once, and the attempt is on record (SEC-05).
  private async refuse(checked: CheckedUpload, error: unknown): Promise<void> {
    if (!(error instanceof AppError)) return;
    await this.deps.storage.delete([checked.pendingKey]);
    await this.deps.audit.record({
      actorId: checked.command.actor.id,
      actorIp: checked.command.ip,
      action: 'media.upload_rejected',
      targetType: 'media',
      targetId: checked.mediaId,
      summary: { filename: checked.filename, code: error.code },
    });
  }

  private async record(checked: CheckedUpload, sizeBytes: number): Promise<MediaView> {
    const { command, mediaId, filename } = checked;
    const storageKey = originalKey(mediaId, checked.extension);
    const item = MediaItem.create({
      id: mediaId,
      storageKey,
      filename,
      mimeType: command.mimeType,
      sizeBytes,
      uploadedBy: command.actor.id,
      createdAt: this.deps.clock.now(),
      metadata: { altText: command.altText ?? null, caption: command.caption ?? null },
    });
    try {
      await this.deps.tx.run(async () => {
        await this.deps.media.create(item);
        await this.deps.audit.record({
          actorId: command.actor.id,
          actorIp: command.ip,
          action: 'media.upload',
          targetType: 'media',
          targetId: mediaId,
          summary: { filename, mime_type: command.mimeType, size_bytes: sizeBytes },
        });
      });
    } catch (error) {
      // When another request finalized this upload first, the file now belongs to its record.
      if (!(error instanceof MediaAlreadyExistsError)) await this.deps.storage.delete([storageKey]);
      throw error;
    }
    const event: MediaUploaded = {
      type: 'MediaUploaded',
      mediaId,
      needsVariants: item.variantStatus === 'pending',
    };
    await this.deps.events.publishAll([event]);
    return toMediaView(this.deps, item);
  }
}
