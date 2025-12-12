/**
 * Determine whether the backend should start in a "relaxed" mode.
 *
 * Relaxed mode is intended for Playwright/dev flows where we want the HTTP server
 * to come up even if external dependencies (MongoDB/Redis) are not available.
 */
export function isRelaxedStartupEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const { HASHHIVE_RELAXED_STARTUP: value } = env;
  return value === '1' || value === 'true';
}
