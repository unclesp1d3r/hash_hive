/**
 * Custom error classes for authentication token validation
 */

export class AuthTokenExpiredError extends Error {
  constructor(message = 'Token expired') {
    super(message);
    this.name = 'AuthTokenExpiredError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthTokenInvalidError extends Error {
  constructor(message = 'Invalid token') {
    super(message);
    this.name = 'AuthTokenInvalidError';
    Error.captureStackTrace(this, this.constructor);
  }
}
