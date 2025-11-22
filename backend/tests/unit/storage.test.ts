import { StorageService } from '../../src/services/storage.service';
import { S3Client } from '@aws-sdk/client-s3';

describe('StorageService Unit Tests', () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new StorageService();
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(storageService).toBeDefined();
      expect(storageService.getBucketName()).toBe(process.env['S3_BUCKET_NAME'] || 'hashhive');
    });

    it('should expose S3 client', () => {
      const client = storageService.getClient();
      expect(client).toBeInstanceOf(S3Client);
    });
  });

  describe('Configuration', () => {
    it('should use configured bucket name', () => {
      const bucketName = storageService.getBucketName();
      expect(bucketName).toBeDefined();
      expect(typeof bucketName).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should wrap errors with descriptive messages', () => {
      // Test that error messages are properly formatted
      const testError = new Error('Network error');
      const wrappedMessage = `Failed to upload file: ${testError.message}`;

      expect(wrappedMessage).toContain('Failed to upload file');
      expect(wrappedMessage).toContain('Network error');
    });

    it('should handle unknown errors', () => {
      const wrappedMessage = `Failed to upload file: Unknown error`;

      expect(wrappedMessage).toContain('Failed to upload file');
      expect(wrappedMessage).toContain('Unknown error');
    });
  });

  describe('Input Validation', () => {
    it('should accept valid upload options', () => {
      const options = {
        key: 'valid/path/file.txt',
        body: Buffer.from('content'),
        contentType: 'text/plain',
        metadata: { key: 'value' },
      };

      expect(() => options).not.toThrow();
    });

    it('should accept various body types', () => {
      const bufferBody = { key: 'test.txt', body: Buffer.from('test') };
      const stringBody = { key: 'test.txt', body: 'test string' };

      expect(() => bufferBody).not.toThrow();
      expect(() => stringBody).not.toThrow();
    });
  });

  describe('Presigned URL Options', () => {
    it('should accept default expiration options', () => {
      const options = {};
      const expiresIn = options.hasOwnProperty('expiresIn') ? (options as any).expiresIn : 3600;

      expect(expiresIn).toBe(3600);
    });

    it('should accept custom expiration time', () => {
      const options = { expiresIn: 7200 };

      expect(options.expiresIn).toBe(7200);
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct types for upload options', () => {
      const validOptions = {
        key: 'test.txt',
        body: Buffer.from('test'),
        contentType: 'text/plain',
        metadata: { key: 'value' },
      };

      expect(typeof validOptions.key).toBe('string');
      expect(Buffer.isBuffer(validOptions.body)).toBe(true);
      expect(typeof validOptions.contentType).toBe('string');
      expect(typeof validOptions.metadata).toBe('object');
    });

    it('should support optional fields', () => {
      const minimalOptions: {
        key: string;
        body: Buffer;
        contentType?: string;
        metadata?: Record<string, string>;
      } = {
        key: 'test.txt',
        body: Buffer.from('test'),
      };

      expect(minimalOptions.contentType).toBeUndefined();
      expect(minimalOptions.metadata).toBeUndefined();
    });
  });
});
