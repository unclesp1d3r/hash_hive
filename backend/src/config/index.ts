import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const DEFAULT_SERVER_PORT = 3001;
const DEFAULT_MONGODB_POOL_SIZE = 10;
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_SESSION_MAX_AGE_MS = 604800000; // 7 days
const MIN_SECRET_LENGTH = 32;
const INVALID_ENV_EXIT_CODE = 1;

/**
 * Generates a secure random secret of the specified length.
 * Uses crypto.randomBytes for cryptographically secure randomness.
 */
const generateSecureSecret = (length: number = MIN_SECRET_LENGTH): string =>
  crypto.randomBytes(length).toString('base64');

// Environment variable schema with validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .transform((val) => Number(val))
    .pipe(z.number().int().positive())
    .default(DEFAULT_SERVER_PORT),
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().url() is the canonical way to validate URLs in current Zod
  API_BASE_URL: z.string().url().default('http://localhost:3001'),

  // MongoDB
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().url() is the canonical way to validate URLs in current Zod
  MONGODB_URI: z.string().url().default('mongodb://localhost:27017/hashhive'),
  MONGODB_MAX_POOL_SIZE: z
    .string()
    .transform((val) => Number(val))
    .pipe(z.number().int().positive())
    .default(DEFAULT_MONGODB_POOL_SIZE),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z
    .string()
    .transform((val) => Number(val))
    .pipe(z.number().int().positive())
    .default(DEFAULT_REDIS_PORT),
  REDIS_PASSWORD: z.string().optional().default(''),

  // S3/MinIO
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.string().url() is the canonical way to validate URLs in current Zod
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  S3_BUCKET_NAME: z.string().default('hashhive'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  // Authentication
  JWT_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
  SESSION_MAX_AGE: z
    .string()
    .transform((val) => Number(val))
    .pipe(z.number().int().positive())
    .default(DEFAULT_SESSION_MAX_AGE_MS),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
});

// Parse and validate environment variables
const parseEnv = (): z.infer<typeof envSchema> & { JWT_SECRET: string; SESSION_SECRET: string } => {
  try {
    const parsed = envSchema.parse(process.env);
    const nodeEnv = parsed.NODE_ENV;

    // Handle JWT_SECRET
    let jwtSecret = parsed.JWT_SECRET;
    if (!jwtSecret) {
      if (nodeEnv === 'production') {
        console.error('❌ JWT_SECRET must be set in production environment');
        process.exit(INVALID_ENV_EXIT_CODE);
      }
      jwtSecret = generateSecureSecret();
    }

    // Handle SESSION_SECRET
    let sessionSecret = parsed.SESSION_SECRET;
    if (!sessionSecret) {
      if (nodeEnv === 'production') {
        console.error('❌ SESSION_SECRET must be set in production environment');
        process.exit(INVALID_ENV_EXIT_CODE);
      }
      sessionSecret = generateSecureSecret();
    }

    return {
      ...parsed,
      JWT_SECRET: jwtSecret,
      SESSION_SECRET: sessionSecret,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      process.exit(INVALID_ENV_EXIT_CODE);
    }
    throw error;
  }
};

const env = parseEnv();

// Helper function to get current NODE_ENV at runtime
const getNodeEnv = (): 'development' | 'test' | 'production' => env.NODE_ENV;

// Export typed configuration
export const config = {
  server: {
    get env() {
      return getNodeEnv();
    },
    get port() {
      return process.env['PORT'] === undefined ? env.PORT : parseInt(process.env['PORT'], 10);
    },
    get baseUrl() {
      return process.env['API_BASE_URL'] ?? env.API_BASE_URL;
    },
    get isDevelopment() {
      return getNodeEnv() === 'development';
    },
    get isProduction() {
      return getNodeEnv() === 'production';
    },
    get isTest() {
      return getNodeEnv() === 'test';
    },
  },
  mongodb: {
    get uri() {
      return process.env['MONGODB_URI'] ?? env.MONGODB_URI;
    },
    get maxPoolSize() {
      return process.env['MONGODB_MAX_POOL_SIZE'] === undefined
        ? env.MONGODB_MAX_POOL_SIZE
        : parseInt(process.env['MONGODB_MAX_POOL_SIZE'], 10);
    },
  },
  redis: {
    get host() {
      return process.env['REDIS_HOST'] ?? env.REDIS_HOST;
    },
    get port() {
      return process.env['REDIS_PORT'] === undefined
        ? env.REDIS_PORT
        : parseInt(process.env['REDIS_PORT'], 10);
    },
    get password() {
      const envPassword = process.env['REDIS_PASSWORD'];
      if (envPassword !== undefined) {
        return envPassword;
      }
      return env.REDIS_PASSWORD === '' ? undefined : env.REDIS_PASSWORD;
    },
  },
  s3: {
    get endpoint() {
      return process.env['S3_ENDPOINT'] ?? env.S3_ENDPOINT;
    },
    get accessKeyId() {
      return process.env['S3_ACCESS_KEY_ID'] ?? env.S3_ACCESS_KEY_ID;
    },
    get secretAccessKey() {
      return process.env['S3_SECRET_ACCESS_KEY'] ?? env.S3_SECRET_ACCESS_KEY;
    },
    get bucketName() {
      return process.env['S3_BUCKET_NAME'] ?? env.S3_BUCKET_NAME;
    },
    get region() {
      return process.env['S3_REGION'] ?? env.S3_REGION;
    },
    get forcePathStyle() {
      if (process.env['S3_FORCE_PATH_STYLE'] !== undefined) {
        return process.env['S3_FORCE_PATH_STYLE'] === 'true';
      }
      return env.S3_FORCE_PATH_STYLE;
    },
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    sessionSecret: env.SESSION_SECRET,
    sessionMaxAge: env.SESSION_MAX_AGE,
  },
  logging: {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
  },
} as const;

export type Config = typeof config;
