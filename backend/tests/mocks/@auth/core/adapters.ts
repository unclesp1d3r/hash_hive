/**
 * Mock for @auth/core/adapters
 * Used in Jest tests since @auth/core/adapters uses ESM which Jest doesn't handle well
 */
export type Adapter = Record<string, unknown>;

