import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface UploadOptions {
  key: string;
  body: Buffer | Readable | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface DownloadResult {
  body: Readable;
  contentType?: string | undefined;
  contentLength?: number | undefined;
  metadata?: Record<string, string> | undefined;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType?: string | undefined;
  lastModified?: Date | undefined;
  metadata?: Record<string, string> | undefined;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

/**
 * StorageService provides an abstraction layer for S3-compatible object storage operations.
 * Supports MinIO for development and AWS S3 for production.
 */
export class StorageService {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private initialized: boolean = false;

  constructor() {
    this.bucketName = config.s3.bucketName;

    // Configure S3 client for MinIO or AWS S3
    this.client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
      forcePathStyle: config.s3.forcePathStyle, // Required for MinIO
    });

    logger.info(
      {
        endpoint: config.s3.endpoint,
        bucket: this.bucketName,
        region: config.s3.region,
      },
      'StorageService initialized'
    );
  }

  /**
   * Initialize the storage service by ensuring the bucket exists.
   * Creates the bucket if it doesn't exist (useful for development with MinIO).
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Check if bucket exists
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      logger.info({ bucket: this.bucketName }, 'Storage bucket exists');
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        // Bucket doesn't exist, create it
        logger.info({ bucket: this.bucketName }, 'Creating storage bucket');
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        logger.info({ bucket: this.bucketName }, 'Storage bucket created');
      } else {
        logger.error({ error, bucket: this.bucketName }, 'Failed to check/create bucket');
        throw error;
      }
    }

    this.initialized = true;
  }

  /**
   * Upload a file to object storage.
   * @param options Upload configuration including key, body, and optional metadata
   * @returns The key of the uploaded object
   */
  async upload(options: UploadOptions): Promise<string> {
    await this.initialize();

    const { key, body, contentType, metadata } = options;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.client.send(command);

      logger.info(
        {
          key,
          bucket: this.bucketName,
          contentType,
        },
        'File uploaded successfully'
      );

      return key;
    } catch (error) {
      logger.error(
        {
          error,
          key,
          bucket: this.bucketName,
        },
        'Failed to upload file'
      );
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Download a file from object storage.
   * @param key The object key to download
   * @returns Download result with body stream and metadata
   */
  async download(key: string): Promise<DownloadResult> {
    await this.initialize();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (response.Body == null) {
        throw new Error('No body in response');
      }

      logger.info(
        {
          key,
          bucket: this.bucketName,
          contentLength: response.ContentLength,
        },
        'File downloaded successfully'
      );

      return {
        body: response.Body as Readable,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        metadata: response.Metadata,
      };
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        logger.warn({ key, bucket: this.bucketName }, 'File not found');
        throw new Error(`File not found: ${key}`);
      }

      logger.error(
        {
          error,
          key,
          bucket: this.bucketName,
        },
        'Failed to download file'
      );
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a file from object storage.
   * @param key The object key to delete
   */
  async delete(key: string): Promise<void> {
    await this.initialize();

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);

      logger.info(
        {
          key,
          bucket: this.bucketName,
        },
        'File deleted successfully'
      );
    } catch (error) {
      logger.error(
        {
          error,
          key,
          bucket: this.bucketName,
        },
        'Failed to delete file'
      );
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get metadata for a file without downloading it.
   * @param key The object key
   * @returns File metadata including size and content type
   */
  async getMetadata(key: string): Promise<FileMetadata> {
    await this.initialize();

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        key,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        throw new Error(`File not found: ${key}`);
      }

      logger.error(
        {
          error,
          key,
          bucket: this.bucketName,
        },
        'Failed to get file metadata'
      );
      throw new Error(
        `Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a presigned URL for secure file downloads.
   * The URL allows temporary access to a private object without requiring authentication.
   * @param key The object key
   * @param options Presigned URL options including expiration time
   * @returns A presigned URL that expires after the specified time
   */
  async getPresignedUrl(key: string, options: PresignedUrlOptions = {}): Promise<string> {
    await this.initialize();

    const { expiresIn = 3600 } = options; // Default 1 hour

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      logger.info(
        {
          key,
          bucket: this.bucketName,
          expiresIn,
        },
        'Presigned URL generated'
      );

      return url;
    } catch (error) {
      logger.error(
        {
          error,
          key,
          bucket: this.bucketName,
        },
        'Failed to generate presigned URL'
      );
      throw new Error(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if a file exists in storage.
   * @param key The object key
   * @returns True if the file exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.getMetadata(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the S3 client instance for advanced operations.
   * Use with caution - prefer using the service methods when possible.
   */
  getClient(): S3Client {
    return this.client;
  }

  /**
   * Get the configured bucket name.
   */
  getBucketName(): string {
    return this.bucketName;
  }
}

// Export a singleton instance
export const storageService = new StorageService();
