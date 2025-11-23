import request from 'supertest';
import type { Express } from 'express';

/**
 * Helper function to get a CSRF token from the server.
 * Makes a GET request to obtain the CSRF token from the X-CSRF-Token header
 * and the CSRF cookie (which contains the secret).
 *
 * @param app - Express application instance
 * @returns Object containing the CSRF token and cookie string for use in requests
 */
export async function getCsrfToken(app: Express): Promise<{
  token: string;
  cookie: string;
}> {
  // Make a GET request to any endpoint to get the CSRF token and cookie
  // The health endpoint is a good choice as it's always available
  const response = await request(app).get('/health');

  // Extract the CSRF token from the response header
  const token = response.headers['x-csrf-token'];
  if (typeof token !== 'string' || token === '') {
    throw new Error('CSRF token not found in response header');
  }

  // Extract the _csrf cookie from the response
  const setCookieHeaders = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];

  const csrfCookie = cookies.find((cookie: string) => cookie.startsWith('_csrf='));
  if (!csrfCookie) {
    throw new Error('CSRF cookie not found in response');
  }

  // Return both the token (for headers) and the full cookie string (for Cookie header)
  return {
    token,
    cookie: csrfCookie.split(';')[0], // Just the key=value part
  };
}

/**
 * Helper function to get CSRF token and cookies for authenticated requests.
 * Combines CSRF token with session cookies.
 *
 * @param app - Express application instance
 * @param sessionCookies - Array of session cookie strings from login response
 * @returns Object containing CSRF token and combined cookie string
 */
export async function getCsrfTokenWithSession(
  app: Express,
  sessionCookies: string[]
): Promise<{
  token: string;
  cookies: string[];
}> {
  const { token, cookie: csrfCookie } = await getCsrfToken(app);

  // Combine CSRF cookie with session cookies
  const allCookies = [csrfCookie, ...sessionCookies];

  return {
    token,
    cookies: allCookies,
  };
}
