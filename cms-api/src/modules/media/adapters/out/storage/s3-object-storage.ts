import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  ObjectStorage,
  ReadRequest,
  ReadUrlRequest,
  StoredObject,
  UploadUrlRequest,
} from '../../../application/ports/out/media-services.port.js';

const DELETE_BATCH = 1000;
const MAX_ATTEMPTS = 6;
const NOT_FOUND = 404;
const PRECONDITION_FAILED = 412;
const RANGE_NOT_SATISFIABLE = 416;

export interface S3StorageConfig {
  readonly bucket: string;
  readonly region: string;
  readonly endpoint?: string;
  // What browsers reach, when it differs from what this server reaches. A signature covers the
  // host, so presigned URLs must be made for this one.
  readonly publicUrl?: string;
  readonly accessKey?: string;
  readonly secretKey?: string;
  readonly forcePathStyle: boolean;
  // Tests lower this to exercise paging without creating a thousand objects.
  readonly listPageSize?: number;
}

function httpStatus(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

function isStatus(error: unknown, ...statuses: readonly number[]): boolean {
  const status = httpStatus(error);
  return status !== undefined && statuses.includes(status);
}

function createClient(config: S3StorageConfig, endpoint: string | undefined): S3Client {
  const { accessKey, secretKey } = config;
  return new S3Client({
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    // Idle pooled connections can die together, and each retry may draw another dead one.
    maxAttempts: MAX_ATTEMPTS,
    ...(endpoint === undefined ? {} : { endpoint }),
    // Left to the SDK's default, presigned uploads would demand a checksum browsers do not send.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    ...(accessKey === undefined || secretKey === undefined
      ? {}
      : { credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } }),
  });
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly signer: S3Client;
  private readonly bucket: string;
  private readonly listPageSize: number | undefined;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.listPageSize = config.listPageSize;
    this.client = createClient(config, config.endpoint);
    this.signer = createClient(config, config.publicUrl ?? config.endpoint);
  }

  // Both headers are signed, so the upload must really have the declared type and size.
  uploadUrl(request: UploadUrlRequest): Promise<string> {
    return getSignedUrl(
      this.signer,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: request.key,
        ContentType: request.contentType,
        ContentLength: request.contentLength,
      }),
      {
        expiresIn: request.expiresInSeconds,
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );
  }

  readUrl(request: ReadUrlRequest): Promise<string> {
    const disposition = request.attachment ? 'attachment' : 'inline';
    const filename = encodeURIComponent(request.filename);
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: request.key,
        ResponseContentDisposition: `${disposition}; filename*=UTF-8''${filename}`,
      }),
      { expiresIn: request.expiresInSeconds },
    );
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: Number(result.ContentLength),
        etag: String(result.ETag),
        // Missing would read as "undefined", which matches no declared type and so is refused.
        contentType: String(result.ContentType),
      };
    } catch (error) {
      if (isStatus(error, NOT_FOUND)) return null;
      throw error;
    }
  }

  async read(key: string, request: ReadRequest): Promise<Uint8Array | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=0-${String(request.maxBytes - 1)}`,
          ...(request.etag === undefined ? {} : { IfMatch: request.etag }),
        }),
      );
      return (await result.Body?.transformToByteArray()) ?? new Uint8Array();
    } catch (error) {
      if (isStatus(error, RANGE_NOT_SATISFIABLE)) return new Uint8Array();
      if (isStatus(error, NOT_FOUND, PRECONDITION_FAILED)) return null;
      throw error;
    }
  }

  async copyIfUnchanged(from: string, to: string, etag: string): Promise<boolean> {
    try {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: to,
          CopySource: `${this.bucket}/${from.split('/').map(encodeURIComponent).join('/')}`,
          CopySourceIfMatch: etag,
        }),
      );
      return true;
    } catch (error) {
      if (isStatus(error, NOT_FOUND, PRECONDITION_FAILED)) return false;
      throw error;
    }
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
  }

  async delete(keys: readonly string[]): Promise<void> {
    for (let start = 0; start < keys.length; start += DELETE_BATCH) {
      const batch = keys.slice(start, start + DELETE_BATCH);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((key) => ({ Key: key })), Quiet: true },
        }),
      );
    }
  }

  async deleteOlderThan(prefix: string, cutoff: Date): Promise<number> {
    let deleted = 0;
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ...(this.listPageSize === undefined ? {} : { MaxKeys: this.listPageSize }),
          ...(token === undefined ? {} : { ContinuationToken: token }),
        }),
      );
      const keys = (page.Contents ?? [])
        .filter((object) => (object.LastModified as Date) < cutoff)
        .map((object) => object.Key as string);
      await this.delete(keys);
      deleted += keys.length;
      token = page.NextContinuationToken;
    } while (token !== undefined);
    return deleted;
  }
}
