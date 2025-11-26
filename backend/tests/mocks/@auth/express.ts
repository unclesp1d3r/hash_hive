/**
 * Mock for @auth/express
 * Used in Jest tests since @auth/express uses ESM which Jest doesn't handle well
 */
export const getSession = jest.fn();
export const ExpressAuth = jest.fn(() => (_req: unknown, _res: unknown, next: unknown) => {
  if (typeof next === 'function') {
    next();
  }
});
