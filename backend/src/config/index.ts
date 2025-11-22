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
  JWT_SECRET: z.string().min(MIN_SECRET_LENGTH).default('change-me-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(MIN_SECRET_LENGTH).default('change-me-in-production'),
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
const parseEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
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

// Export typed configuration
export const config = {
  server: {
    env: env.NODE_ENV,
    port: env.PORT,
    baseUrl: env.API_BASE_URL,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
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
      return (
        process.env['REDIS_PASSWORD'] ??
        (env.REDIS_PASSWORD === '' ? undefined : env.REDIS_PASSWORD)
      );
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
