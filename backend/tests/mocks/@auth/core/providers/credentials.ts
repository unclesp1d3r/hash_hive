/**
 * Mock for @auth/core/providers/credentials
 * Used in Jest tests since @auth/core/providers/credentials uses ESM which Jest doesn't handle well
 */
const Credentials = jest.fn((config: unknown) => config);
export default Credentials;

