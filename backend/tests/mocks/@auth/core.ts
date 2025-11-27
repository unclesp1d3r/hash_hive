/**
 * Mock for @auth/core
 * Used in Jest tests since @auth/core uses ESM which Jest doesn't handle well
 */
export type AuthConfig = Record<string, unknown>;
export type Adapter = Record<string, unknown>;
