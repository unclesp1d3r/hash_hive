import * as schema from '@hashhive/shared';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from '../config/env.js';
import { db } from '../db/index.js';

export const auth = betterAuth({
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.baSessions,
      account: schema.baAccounts,
      verification: schema.baVerifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // No self-registration; users created by admin/seed only
    requireEmailVerification: false, // Air-gapped: no email service available
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: async (password: string) =>
        Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 }),
      verify: async ({ hash, password }: { hash: string; password: string }) =>
        Bun.password.verify(password, hash),
    },
  },

  session: {
    expiresIn: 28800, // 8 hours
    updateAge: 3600, // Refresh every hour on activity
    // No cookieCache -- immediate session revocation is more important than
    // saving a DB lookup per request for 1-3 concurrent dashboard users.
  },

  user: {
    modelName: 'users',
    fields: {
      name: 'name',
      email: 'email',
      emailVerified: 'email_verified',
      image: 'image',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  account: {
    modelName: 'ba_accounts',
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      idToken: 'id_token',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  advanced: {
    database: {
      generateId: ({ model }) => {
        if (model === 'user') return false; // Let PostgreSQL serial auto-generate
        return crypto.randomUUID();
      },
    },
    cookiePrefix: 'hh',
  },

  // In production (air-gapped Docker Compose), frontend and backend are same-origin
  // behind a reverse proxy, so no cross-origin allowance is needed. In dev, allow localhost.
  trustedOrigins: env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'],
});
