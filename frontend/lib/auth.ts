'use client';

import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';

/**
 * Frontend NextAuth v4 configuration for Next.js
 * Provides SessionProvider, useSession hook, and signIn/signOut functions
 *
 * Configuration:
 * - NEXTAUTH_URL: The canonical URL of the frontend application (required by NextAuth)
 * - NEXT_PUBLIC_API_URL: The backend API base URL (exposed as API_URL in this module)
 *
 * The backend Auth.js Express endpoint is mounted at /auth/* and is accessed
 * via NEXT_PUBLIC_API_URL (exposed as API_URL), not NEXTAUTH_URL.
 * Use getAuthApiUrl() to get the full backend Auth.js endpoint URL: ${API_URL}/auth
 */
// eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Destructuring breaks with process.env
const envApiUrl = process.env['NEXT_PUBLIC_API_URL'];
const API_URL = typeof envApiUrl === 'string' ? envApiUrl : 'http://localhost:3001';

export { SessionProvider, useSession, signIn, signOut };

/**
 * Get the backend Auth.js API URL.
 *
 * Constructs the full URL by appending '/auth' to the API_URL (which comes from
 * NEXT_PUBLIC_API_URL environment variable). This is the Express backend endpoint,
 * not the NextAuth frontend endpoint (which uses NEXTAUTH_URL).
 *
 * @returns The full URL of the backend Auth.js Express endpoint (${API_URL}/auth)
 */
export function getAuthApiUrl(): string {
  return `${API_URL}/auth`;
}
