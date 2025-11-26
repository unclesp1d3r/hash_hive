/**
 * Mock for @auth/mongodb-adapter
 * Used in Jest tests since @auth/mongodb-adapter uses ESM which Jest doesn't handle well
 */
export const MongoDBAdapter = jest.fn(() => ({}));

