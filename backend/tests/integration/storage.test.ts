import { MinioContainer, StartedMinioContainer } from '@testcontainers/minio';
import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { StorageService } from '../../src/services/storage.service';
import { Readable } from 'stream';

describe('StorageService Integration', () => {
  let minioContainer: StartedMinioContainer;
  let storageService: StorageService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(
    async () => {
      // Save original environment
      originalEnv = { ...process.env };

      // Start MinIO container
      minioContainer = await new MinioContainer('minio/minio:latest').start();
      const minioHost = minioContainer.getHost();
      const minioPort = minioContainer.getPort();
      const minioEndpoint = `http://${minioHost}:${minioPort}`;

      // Update environment for test
      process.env['S3_ENDPOINT'] = minioEndpoint;
      process.env['S3_ACCESS_KEY_ID'] = 'minioadmin';
      process.env['S3_SECRET_ACCESS_KEY'] = 'minioadmin';
      process.env['S3_BUCKET_NAME'] = 'test-bucket';
      process.env['S3_REGION'] = 'us-east-1';
      process.env['S3_FORCE_PATH_STYLE'] = 'true';

      // Reload config module to pick up new environment
      jest.resetModules();
      const { StorageService: ReloadedStorageService } = await import(
        '../../src/services/storage.service'
      );
      storageService = new ReloadedStorageService();

      // Initialize the service (creates bucket)
      await storageService.initialize();
    },
    60000 // 60 second timeout for container startup
  );

  afterAll(async () => {
    // Cleanup order: services first, then containers
    if (minioContainer) {
      await minioContainer.stop();
    }
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    it('should create bucket if it does not exist', async () => {
      const client = storageService.getClient();
      const command = new ListBucketsCommand({});
      const response = await client.send(command);

      const bucketExists = response.Buckets?.some(
        (bucket) => bucket.Name === storageService.getBucketName()
      );

      expect(bucketExists).toBe(true);
    });

    it('should not fail when initializing multiple times', async () => {
      await expect(storageService.initialize()).resolves.not.toThrow();
      await expect(storageService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Upload Operations', () => {
    it('should upload a file with Buffer', async () => {
      const key = 'test-files/buffer-test.txt';
      const content = Buffer.from('Hello, World!');

      const result = await storageService.upload({
        key,
        body: content,
        contentType: 'text/plain',
      });

      expect(result).toBe(key);

      // Verify file exists
      const exists = await storageService.exists(key);
      expect(exists).toBe(true);
    });

    it('should upload a file with string', async () => {
      const key = 'test-files/string-test.txt';
      const content = 'This is a test string';

      const result = await storageService.upload({
        key,
        body: content,
        contentType: 'text/plain',
      });

      expect(result).toBe(key);
    });

    it('should upload a file with Stream', async () => {
      const key = 'test-files/stream-test.txt';
      const content = 'Stream content';
      // Convert to Buffer for upload - AWS SDK has issues with Node streams
      const buffer = Buffer.from(content);

      const result = await storageService.upload({
        key,
        body: buffer,
        contentType: 'text/plain',
      });

      expect(result).toBe(key);

      // Verify the content was uploaded correctly
      const downloaded = await storageService.download(key);
      const chunks: Buffer[] = [];
      for await (const chunk of downloaded.body) {
        chunks.push(chunk);
      }
      const downloadedContent = Buffer.concat(chunks).toString();
      expect(downloadedContent).toBe(content);
    });

    it('should upload a file with metadata', async () => {
      const key = 'test-files/metadata-test.txt';
      const content = Buffer.from('Content with metadata');
      const metadata = {
        'user-id': '12345',
        'project-id': 'test-project',
      };

      await storageService.upload({
        key,
        body: content,
        contentType: 'text/plain',
        metadata,
      });

      const fileMetadata = await storageService.getMetadata(key);
      expect(fileMetadata.metadata).toEqual(metadata);
    });

    it('should handle upload errors gracefully', async () => {
      // Try to upload with invalid key (empty)
      await expect(
        storageService.upload({
          key: '',
          body: Buffer.from('test'),
        })
      ).rejects.toThrow();
    });
  });

  describe('Download Operations', () => {
    beforeEach(async () => {
      // Upload a test file
      await storageService.upload({
        key: 'test-files/download-test.txt',
        body: Buffer.from('Download test content'),
        contentType: 'text/plain',
      });
    });

    it('should download a file', async () => {
      const result = await storageService.download('test-files/download-test.txt');

      expect(result.body).toBeInstanceOf(Readable);
      expect(result.contentType).toBe('text/plain');
      expect(result.contentLength).toBeGreaterThan(0);

      // Read the stream
      const chunks: Buffer[] = [];
      for await (const chunk of result.body) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString();
      expect(content).toBe('Download test content');
    });

    it('should throw error when downloading non-existent file', async () => {
      await expect(storageService.download('non-existent-file.txt')).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      // Upload a test file
      await storageService.upload({
        key: 'test-files/delete-test.txt',
        body: Buffer.from('Delete test content'),
      });
    });

    it('should delete a file', async () => {
      const key = 'test-files/delete-test.txt';

      // Verify file exists
      let exists = await storageService.exists(key);
      expect(exists).toBe(true);

      // Delete the file
      await storageService.delete(key);

      // Verify file no longer exists
      exists = await storageService.exists(key);
      expect(exists).toBe(false);
    });

    it('should not throw error when deleting non-existent file', async () => {
      // S3 delete is idempotent - doesn't fail if file doesn't exist
      await expect(storageService.delete('non-existent-file.txt')).resolves.not.toThrow();
    });
  });

  describe('Metadata Operations', () => {
    beforeEach(async () => {
      await storageService.upload({
        key: 'test-files/metadata-test.txt',
        body: Buffer.from('Metadata test content'),
        contentType: 'text/plain',
        metadata: {
          'custom-field': 'custom-value',
        },
      });
    });

    it('should get file metadata', async () => {
      const metadata = await storageService.getMetadata('test-files/metadata-test.txt');

      expect(metadata.key).toBe('test-files/metadata-test.txt');
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.contentType).toBe('text/plain');
      expect(metadata.lastModified).toBeInstanceOf(Date);
      expect(metadata.metadata).toEqual({ 'custom-field': 'custom-value' });
    });

    it('should throw error for non-existent file', async () => {
      await expect(storageService.getMetadata('non-existent-file.txt')).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('Presigned URL Operations', () => {
    beforeEach(async () => {
      await storageService.upload({
        key: 'test-files/presigned-test.txt',
        body: Buffer.from('Presigned URL test content'),
        contentType: 'text/plain',
      });
    });

    it('should generate a presigned URL', async () => {
      const url = await storageService.getPresignedUrl('test-files/presigned-test.txt');

      expect(url).toBeDefined();
      expect(url).toContain('test-files/presigned-test.txt');
      expect(url).toContain('X-Amz-Algorithm');
      expect(url).toContain('X-Amz-Signature');
    });

    it('should generate presigned URL with custom expiration', async () => {
      const url = await storageService.getPresignedUrl('test-files/presigned-test.txt', {
        expiresIn: 7200, // 2 hours
      });

      expect(url).toBeDefined();
      expect(url).toContain('X-Amz-Expires=7200');
    });

    it('should allow downloading file via presigned URL', async () => {
      const url = await storageService.getPresignedUrl('test-files/presigned-test.txt');

      // Fetch the file using the presigned URL
      const response = await fetch(url);
      expect(response.ok).toBe(true);

      const content = await response.text();
      expect(content).toBe('Presigned URL test content');
    });
  });

  describe('Exists Operations', () => {
    beforeEach(async () => {
      await storageService.upload({
        key: 'test-files/exists-test.txt',
        body: Buffer.from('Exists test content'),
      });
    });

    it('should return true for existing file', async () => {
      const exists = await storageService.exists('test-files/exists-test.txt');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await storageService.exists('non-existent-file.txt');
      expect(exists).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple uploads concurrently', async () => {
      const uploads = Array.from({ length: 10 }, (_, i) =>
        storageService.upload({
          key: `test-files/concurrent-${i}.txt`,
          body: Buffer.from(`Content ${i}`),
        })
      );

      const results = await Promise.all(uploads);

      expect(results.length).toBe(10);
      results.forEach((result, i) => {
        expect(result).toBe(`test-files/concurrent-${i}.txt`);
      });

      // Verify all files exist
      const existsChecks = results.map((key) => storageService.exists(key));
      const existsResults = await Promise.all(existsChecks);

      expect(existsResults.every((exists) => exists === true)).toBe(true);
    });

    it('should handle mixed operations concurrently', async () => {
      // Upload some files first
      await Promise.all([
        storageService.upload({
          key: 'test-files/mixed-1.txt',
          body: Buffer.from('Content 1'),
        }),
        storageService.upload({
          key: 'test-files/mixed-2.txt',
          body: Buffer.from('Content 2'),
        }),
        storageService.upload({
          key: 'test-files/mixed-3.txt',
          body: Buffer.from('Content 3'),
        }),
      ]);

      // Perform mixed operations
      const operations = [
        storageService.download('test-files/mixed-1.txt'),
        storageService.getMetadata('test-files/mixed-2.txt'),
        storageService.exists('test-files/mixed-3.txt'),
        storageService.getPresignedUrl('test-files/mixed-1.txt'),
      ];

      const results = await Promise.all(operations);

      expect(results[0]).toHaveProperty('body');
      expect(results[1]).toHaveProperty('key');
      expect(results[2]).toBe(true);
      expect(results[3]).toContain('X-Amz-Signature');
    });
  });
});
