import { AuthService } from '../../src/services/auth.service.authjs';
import { getSession } from '@auth/express';
import { authConfig } from '../../src/config/auth.config';
import type { Request } from 'express';

// Mock @auth/express
jest.mock('@auth/express', () => ({
  getSession: jest.fn(),
}));

describe('AuthService (Auth.js)', () => {
  let mockReq: Partial<Request>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      id: 'test-request-id',
      headers: {},
      cookies: {},
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should throw error indicating deprecated method', () => {
      expect(() => {
        AuthService.login(mockReq as Request, 'test@example.com', 'password123');
      }).toThrow('Use POST /auth/signin/credentials endpoint for login');
    });
  });

  describe('logout', () => {
    it('should throw error indicating deprecated method', () => {
      expect(() => {
        AuthService.logout(mockReq as Request);
      }).toThrow('Use POST /auth/signout endpoint for logout');
    });
  });

  describe('getSession', () => {
    it('should return session when available', async () => {
      const mockSession = {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['admin'],
        },
      };

      (getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await AuthService.getSession(mockReq as Request);

      expect(result).toEqual(mockSession);
      expect(getSession).toHaveBeenCalledWith(mockReq, authConfig);
    });

    it('should return null when session is not available', async () => {
      (getSession as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.getSession(mockReq as Request);

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (getSession as jest.Mock).mockRejectedValue(new Error('Session error'));

      const result = await AuthService.getSession(mockReq as Request);

      expect(result).toBeNull();
    });
  });

  describe('getUser', () => {
    it('should return user from session when available', async () => {
      const mockSession = {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['admin'],
        },
      };

      (getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await AuthService.getUser(mockReq as Request);

      expect(result).toEqual(mockSession.user);
    });

    it('should return null when session has no user', async () => {
      (getSession as jest.Mock).mockResolvedValue({});

      const result = await AuthService.getUser(mockReq as Request);

      expect(result).toBeNull();
    });

    it('should return null when session is null', async () => {
      (getSession as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.getUser(mockReq as Request);

      expect(result).toBeNull();
    });
  });
});
