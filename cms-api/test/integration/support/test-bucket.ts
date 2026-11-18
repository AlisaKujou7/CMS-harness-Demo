import { randomUUID } from 'node:crypto';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { inject } from 'vitest';

export const STORAGE_KEY = 'test-only-key';
export const STORAGE_SECRET = 'test-only-secret';
const ATTEMPTS = 20;
const RETRY_DELAY_MS = 500;

// A container that has just reported healthy can still drop the first connections through Docker's
// port forwarding, and the SDK's own retries are over within milliseconds.
export async function createTestBucket(): Promise<{ endpoint: string; bucket: string }> {
  const endpoint = inject('minioUrl');
  const bucket = `test-${randomUUID()}`;
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: STORAGE_KEY, secretAccessKey: STORAGE_SECRET },
  });
  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        return { endpoint, bucket };
      } catch (error) {
        if (attempt === ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  } finally {
    client.destroy();
  }
}
