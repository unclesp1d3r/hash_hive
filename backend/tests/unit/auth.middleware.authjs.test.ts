import type { Request, Response, NextFunction } from 'express';
import { authenticateSession, optionalAuth } from '../../src/middleware/auth.middleware.authjs';
import { getSession } from '@auth/express';
import { User } from '../../src/models/user.model';
import { AppError } from '../../src/middleware/error-handler';
import type { User as UserType } from '../../../shared/src/types';

// Mock @auth/express
jest.mock('@auth/express', () => ({
  getSession: jest.fn(),
}));

// Mock User model
jest.mock('../../src/models/user.model', () => ({
  User: {
    findById: jest.fn(),
  },
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  },
  JsonWebTokenError: class JsonWebTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  },
}));

describe('Auth.js Authentication Middleware', () => {
  let mockReq: Partial<Request> & { user?: UserType };
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      id: 'test-request-id',
      headers: {},
      cookies: {},
    };
    mockRes = {
      locals: {},
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateSession', () => {
    it('should authenticate valid session and attach user to request', async () => {
      const mockSession = {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['admin'],
        },
      };

      const mockUser = {
        _id: { toString: () => 'user-id' },
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (getSession as jest.Mock).mockResolvedValue(mockSession);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await authenticateSession(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user-id');
      expect(mockReq.user?.roles).toEqual(['admin']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw AppError for invalid session', async () => {
      (getSession as jest.Mock).mockResolvedValue(null);

      await expect(
        authenticateSession(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw AppError for inactive user', async () => {
      const mockSession = {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
          roles: [],
        },
      };

      const mockUser = {
        _id: { toString: () => 'user-id' },
        email: 'test@example.com',
        name: 'Test User',
        status: 'disabled',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (getSession as jest.Mock).mockResolvedValue(mockSession);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        authenticateSession(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authenticateJWT', () => {
    it('should authenticate valid JWT token and attach user to request', async () => {
      const { authenticateJWT } = await import('../../src/middleware/auth.middleware.authjs');
      const jwt = await import('jsonwebtoken');
      const mockToken = 'valid-jwt-token';
      const mockPayload = {
        userId: 'user-id',
        roles: ['admin'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockUser = {
        _id: { toString: () => 'user-id' },
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockReq.headers = {
        authorization: `Bearer ${mockToken}`,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user-id');
      expect(mockReq.user?.roles).toEqual(['admin']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw AppError for missing authorization header', async () => {
      const { authenticateJWT } = await import('../../src/middleware/auth.middleware.authjs');
      mockReq.headers = {};

      await expect(
        authenticateJWT(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw AppError for invalid token format', async () => {
      const { authenticateJWT } = await import('../../src/middleware/auth.middleware.authjs');
      mockReq.headers = {
        authorization: 'InvalidFormat token',
      };

      await expect(
        authenticateJWT(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should continue without user if no session or JWT', async () => {
      (getSession as jest.Mock).mockResolvedValue(null);
      mockReq.headers = {};

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach user if valid session exists', async () => {
      const mockSession = {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['admin'],
        },
      };

      const mockUser = {
        _id: { toString: () => 'user-id' },
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (getSession as jest.Mock).mockResolvedValue(mockSession);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach user if valid JWT exists when session is not available', async () => {
      const { optionalAuth: optionalAuthFn } = await import(
        '../../src/middleware/auth.middleware.authjs'
      );
      const jwt = await import('jsonwebtoken');
      const mockPayload = {
        userId: 'user-id',
        roles: ['admin'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockUser = {
        _id: { toString: () => 'user-id' },
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (getSession as jest.Mock).mockResolvedValue(null);
      mockReq.headers = {
        authorization: 'Bearer valid-jwt-token',
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await optionalAuthFn(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user-id');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user if JWT is invalid', async () => {
      const { optionalAuth: optionalAuthFn } = await import(
        '../../src/middleware/auth.middleware.authjs'
      );
      const jwt = await import('jsonwebtoken');

      (getSession as jest.Mock).mockResolvedValue(null);
      mockReq.headers = {
        authorization: 'Bearer invalid-token',
      };

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await optionalAuthFn(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
