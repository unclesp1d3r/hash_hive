'use client';

import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';

/**
 * Frontend Auth.js configuration
 * Provides SessionProvider, useSession hook, and signIn/signOut functions
 * API URL points to backend /auth/* endpoint (Auth.js Express endpoint)
 */
// eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Destructuring breaks with process.env
const envApiUrl = process.env['NEXT_PUBLIC_API_URL'];
const API_URL = typeof envApiUrl === 'string' ? envApiUrl : 'http://localhost:3001';

export { SessionProvider, useSession, signIn, signOut };

/**
 * Get API URL for Auth.js
 */
export function getAuthApiUrl(): string {
  return `${API_URL}/auth`;
}

/**
 * NextAuth configuration for frontend
 * Points to backend Auth.js Express endpoint
 */
export const nextAuthConfig = {
  baseUrl: API_URL,
  basePath: '/auth',
};

