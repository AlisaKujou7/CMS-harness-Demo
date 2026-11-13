import { AppError, ForbiddenError } from '../../../../shared/kernel/app-error.js';
import {
  MediaItem,
  type MediaMetadata,
  validMediaMetadata,
} from '../../domain/entities/media-item.entity.js';
import {
  FileTooLargeError,
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
  readonly metadata: MediaMetadata;
}

// FR-MEDIA-03 and SEC-05. Nothing trusts what the upload claims: the stored type, the extension and
// the bytes must agree. The file then moves out of the writable area, conditional on its version,
// so a second PUT to the same presigned URL cannot swap in something that was never checked.
export class FinalizeMedia implements FinalizeMediaUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(command: FinalizeMediaCommand): Promise<MediaView> {
    const upload = parseUploadKey(command.storageKey);
    if (upload.ownerId !== command.actor.id) throw new ForbiddenError();
    // First of all, because these mistakes can be corrected and the upload should survive them.
    const checked: CheckedUpload = {
      command,
      pendingKey: command.storageKey,
      mediaId: upload.uploadId,
      extension: upload.extension,
      filename: normalizeFilename(command.filename),
      metadata: validMediaMetadata({
        altText: command.altText ?? null,
        caption: command.caption ?? null,
      }),
    };

    const stored = await this.deps.storage.head(checked.pendingKey);
    if (!stored) throw new UploadNotFoundError();

    let item: MediaItem;
    try {
      await this.assertMatches(checked, stored);
      const clean = command.mimeType === SVG_MIME ? await this.sanitizedSvg(checked, stored) : null;
      item = this.toItem(checked, clean?.length ?? stored.size);
      await this.record(checked, item, stored, clean);
    } catch (error) {
      await this.refuse(checked, error);
      throw error;
    }
    await this.removePending(checked.pendingKey);
    const event: MediaUploaded = {
      type: 'MediaUploaded',
      mediaId: item.id,
      needsVariants: item.variantStatus === 'pending',
    };
    await this.deps.events.publishAll([event]);
    return toMediaView(this.deps, item);
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

  private async sanitizedSvg(checked: CheckedUpload, stored: StoredObject): Promise<Uint8Array> {
    if (stored.size > MAX_SVG_BYTES) throw new FileTooLargeError(MAX_SVG_BYTES);
    const bytes = await this.deps.storage.read(checked.pendingKey, {
      etag: stored.etag,
      maxBytes: MAX_SVG_BYTES,
    });
    if (!bytes) throw new UploadChangedError();
    const clean = this.deps.svg.sanitize(bytes);
    if (!clean) throw new UnsupportedMediaTypeError('the file is not a well-formed SVG');
    return clean;
  }

  private toItem(checked: CheckedUpload, sizeBytes: number): MediaItem {
    return MediaItem.create({
      id: checked.mediaId,
      storageKey: originalKey(checked.mediaId, checked.extension),
      filename: checked.filename,
      mimeType: checked.command.mimeType,
      sizeBytes,
      uploadedBy: checked.command.actor.id,
      createdAt: this.deps.clock.now(),
      metadata: checked.metadata,
    });
  }

  // The record comes first. Its id is the upload's, so a repeat of this upload stops here, waiting
  // for any finalize in progress, and can never reach the file that a record already stands for.
  private async record(
    checked: CheckedUpload,
    item: MediaItem,
    stored: StoredObject,
    clean: Uint8Array | null,
  ): Promise<void> {
    const { command, pendingKey, filename } = checked;
    const progress = { moved: false };
    try {
      await this.deps.tx.run(async () => {
        await this.deps.media.create(item);
        await this.moveIntoPlace(pendingKey, item, { stored, clean });
        progress.moved = true;
        await this.deps.audit.record({
          actorId: command.actor.id,
          actorIp: command.ip,
          action: 'media.upload',
          targetType: 'media',
          targetId: item.id,
          summary: { filename, mime_type: item.mimeType, size_bytes: item.sizeBytes },
        });
      });
    } catch (error) {
      if (progress.moved) await this.deps.storage.delete([item.storageKey]);
      throw error;
    }
  }

  private async moveIntoPlace(
    pendingKey: string,
    item: MediaItem,
    source: { readonly stored: StoredObject; readonly clean: Uint8Array | null },
  ): Promise<void> {
    const { storage } = this.deps;
    if (source.clean) {
      await storage.put(item.storageKey, source.clean, item.mimeType);
    } else if (!(await storage.copyIfUnchanged(pendingKey, item.storageKey, source.stored.etag))) {
      throw new UploadChangedError();
    }
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

  // The media is safely recorded by now. A leftover here is harmless, and the daily purge takes it.
  private async removePending(key: string): Promise<void> {
    try {
      await this.deps.storage.delete([key]);
    } catch (error) {
      this.deps.logger.error('Could not remove a finished upload', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
