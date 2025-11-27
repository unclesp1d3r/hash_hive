'use client';

import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';

/**
 * Frontend Auth.js configuration for Next.js
 * Provides SessionProvider, useSession hook, and signIn/signOut functions
 * API URL points to backend /auth/* endpoint (Auth.js Express endpoint)
 *
 * For next-auth v5, the basePath configuration is handled via NEXTAUTH_URL
 * and the provider configuration in the SessionProvider component.
 */
// eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Destructuring breaks with process.env
const envApiUrl = process.env['NEXT_PUBLIC_API_URL'];
const API_URL = typeof envApiUrl === 'string' ? envApiUrl : 'http://localhost:3001';

export { SessionProvider, useSession, signIn, signOut };

/**
 * Get the backend Auth.js API URL.
 *
 * @returns The full URL of the backend Auth.js endpoint
 */
export function getAuthApiUrl(): string {
  return `${API_URL}/auth`;
}

/**
 * NextAuth v5 configuration for frontend
 * Points to backend Auth.js Express endpoint
 *
 * Note: In next-auth v5, configuration is primarily done via environment variables
 * and the SessionProvider component props. The basePath is determined by the
 * backend Auth.js ExpressAuth mount point (/auth).
 */
export const nextAuthConfig = {
  baseUrl: API_URL,
  basePath: '/auth',
};