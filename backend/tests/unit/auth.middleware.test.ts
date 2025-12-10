import type { Request, Response, NextFunction } from 'express';
import {
  authenticateJWT,
  authenticateSession,
  optionalAuth,
} from '../../src/middleware/auth.middleware';
import { AuthService } from '../../src/services/auth.service';
import { AppError } from '../../src/middleware/error-handler';
import { AuthTokenExpiredError, AuthTokenInvalidError } from '../../src/utils/auth-errors';
import { User } from '../../src/models/user.model';
import { aggregateUserRoles } from '../../src/utils/role-aggregator';

// Mock dependencies
jest.mock('../../src/services/auth.service');
jest.mock('../../src/models/user.model');
jest.mock('../../src/utils/role-aggregator');

describe('Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      id: 'test-request-id',
      headers: {},
      cookies: {},
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('authenticateJWT', () => {
    it('should attach user to req.user and call next with valid token', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockReq.headers = {
        authorization: 'Bearer valid_token',
      };

      (AuthService.validateToken as jest.Mock).mockReturnValue({
        userId: 'user123',
        roles: ['admin'],
      });

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 with AUTH_TOKEN_INVALID code for invalid token', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid_token',
      };

      (AuthService.validateToken as jest.Mock).mockImplementation(() => {
        throw new AuthTokenInvalidError('Invalid token');
      });

      try {
        await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
        fail('Should have thrown AppError');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        if (error instanceof AppError) {
          expect(error.code).toBe('AUTH_TOKEN_INVALID');
          expect(error.statusCode).toBe(401);
        }
      }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with AUTH_TOKEN_EXPIRED code for expired token', async () => {
      mockReq.headers = {
        authorization: 'Bearer expired_token',
      };

      (AuthService.validateToken as jest.Mock).mockImplementation(() => {
        throw new AuthTokenExpiredError('Token expired');
      });

      try {
        await authenticateJWT(mockReq as Request, mockRes as Response, mockNext);
        fail('Should have thrown AppError');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        if (error instanceof AppError) {
          expect(error.code).toBe('AUTH_TOKEN_EXPIRED');
          expect(error.statusCode).toBe(401);
        }
      }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with missing token', async () => {
      mockReq.headers = {};

      await expect(
        authenticateJWT(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authenticateSession', () => {
    it('should attach user to req.user and call next with valid session', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockReq.cookies = {
        sessionId: 'valid_session_id',
      };

      (AuthService.validateSession as jest.Mock).mockResolvedValue(mockUser);
      (aggregateUserRoles as jest.Mock).mockResolvedValue(['admin']);

      await authenticateSession(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.id).toBe('user123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 with invalid session', async () => {
      mockReq.cookies = {
        sessionId: 'invalid_session_id',
      };

      (AuthService.validateSession as jest.Mock).mockResolvedValue(null);

      await expect(
        authenticateSession(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with missing session', async () => {
      mockReq.cookies = {};

      await expect(
        authenticateSession(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should attach user with valid auth', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockReq.cookies = {
        sessionId: 'valid_session_id',
      };

      (AuthService.validateSession as jest.Mock).mockResolvedValue(mockUser);
      (aggregateUserRoles as jest.Mock).mockResolvedValue(['admin']);

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without user when not authenticated', async () => {
      mockReq.cookies = {};

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
