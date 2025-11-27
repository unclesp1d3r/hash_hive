'use client';

import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';

/**
 * Frontend NextAuth v4 configuration for Next.js
 * Provides SessionProvider, useSession hook, and signIn/signOut functions
 *
 * Configuration:
 * - NEXTAUTH_URL: The canonical URL of the frontend application (required)
 * - basePath: Configured via SessionProvider props if needed (defaults to /api/auth)
 *
 * The backend Auth.js Express endpoint is mounted at /auth/* and is accessed
 * via the NEXTAUTH_URL environment variable.
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
