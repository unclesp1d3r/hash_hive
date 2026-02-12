import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env.js';

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export async function uploadFile(
  key: string,
  body: Buffer | ReadableStream,
  contentType: string,
  bucket?: string
) {
  return s3.send(
    new PutObjectCommand({
      Bucket: bucket ?? env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function downloadFile(key: string, bucket?: string) {
  return s3.send(
    new GetObjectCommand({
      Bucket: bucket ?? env.S3_BUCKET,
      Key: key,
    })
  );
}

export async function deleteFile(key: string, bucket?: string) {
  return s3.send(
    new DeleteObjectCommand({
      Bucket: bucket ?? env.S3_BUCKET,
      Key: key,
    })
  );
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/["\r\n;]/g, '_');
}

export async function getPresignedUrl(
  key: string,
  expiresIn = 3600,
  opts?: { bucket?: string; filename?: string }
): Promise<string> {
  const safeFilename = opts?.filename ? sanitizeFilename(opts.filename) : undefined;
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: opts?.bucket ?? env.S3_BUCKET,
      Key: key,
      ...(safeFilename
        ? { ResponseContentDisposition: `attachment; filename="${safeFilename}"` }
        : {}),
    }),
    { expiresIn }
  );
}

export async function checkMinioHealth(): Promise<{
  status: 'connected' | 'disconnected';
  bucket: string;
}> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return { status: 'connected', bucket: env.S3_BUCKET };
  } catch {
    return { status: 'disconnected', bucket: env.S3_BUCKET };
  }
}
