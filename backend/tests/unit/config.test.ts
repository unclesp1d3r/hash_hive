import { config } from '../../src/config';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('MongoDB Config', () => {
    it('should return default values when env vars are not set', () => {
      delete process.env['MONGODB_URI'];
      delete process.env['MONGODB_MAX_POOL_SIZE'];

      expect(config.mongodb.uri).toBeDefined();
      expect(config.mongodb.maxPoolSize).toBe(10);
    });

    it('should return env var values when set', () => {
      process.env['MONGODB_URI'] = 'mongodb://test:27017/test';
      process.env['MONGODB_MAX_POOL_SIZE'] = '20';

      expect(config.mongodb.uri).toBe('mongodb://test:27017/test');
      expect(config.mongodb.maxPoolSize).toBe(20);
    });
  });

  describe('Redis Config', () => {
    it('should return default values when env vars are not set', () => {
      delete process.env['REDIS_HOST'];
      delete process.env['REDIS_PORT'];
      delete process.env['REDIS_PASSWORD'];

      expect(config.redis.host).toBe('localhost');
      expect(config.redis.port).toBe(6379);
      expect(config.redis.password).toBeUndefined();
    });

    it('should return env var values when set', () => {
      process.env['REDIS_HOST'] = 'redis-test';
      process.env['REDIS_PORT'] = '6380';
      process.env['REDIS_PASSWORD'] = 'secret';

      expect(config.redis.host).toBe('redis-test');
      expect(config.redis.port).toBe(6380);
      expect(config.redis.password).toBe('secret');
    });

    it('should handle empty password correctly', () => {
      process.env['REDIS_PASSWORD'] = '';
      // Empty strings are normalized to undefined for both process.env and env sources
      // so Redis clients receive undefined for "no authentication" consistently
      expect(config.redis.password).toBeUndefined();
    });
  });

  describe('S3 Config', () => {
    it('should return default values when env vars are not set', () => {
      delete process.env['S3_ENDPOINT'];
      delete process.env['S3_ACCESS_KEY_ID'];
      delete process.env['S3_SECRET_ACCESS_KEY'];
      delete process.env['S3_BUCKET_NAME'];
      delete process.env['S3_REGION'];
      delete process.env['S3_FORCE_PATH_STYLE'];

      expect(config.s3.endpoint).toBeDefined();
      expect(config.s3.bucketName).toBe('hashhive');
      expect(config.s3.forcePathStyle).toBe(true);
    });

    it('should return env var values when set', () => {
      process.env['S3_ENDPOINT'] = 'http://s3-test:9000';
      process.env['S3_ACCESS_KEY_ID'] = 'test-key';
      process.env['S3_SECRET_ACCESS_KEY'] = 'test-secret';
      process.env['S3_BUCKET_NAME'] = 'test-bucket';
      process.env['S3_REGION'] = 'us-west-1';
      process.env['S3_FORCE_PATH_STYLE'] = 'false';

      expect(config.s3.endpoint).toBe('http://s3-test:9000');
      expect(config.s3.accessKeyId).toBe('test-key');
      expect(config.s3.secretAccessKey).toBe('test-secret');
      expect(config.s3.bucketName).toBe('test-bucket');
      expect(config.s3.region).toBe('us-west-1');
      expect(config.s3.forcePathStyle).toBe(false);
    });
  });
});
