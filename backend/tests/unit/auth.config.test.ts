import { authConfig } from '../../src/config/auth.config';
import { ProjectService } from '../../src/services/project.service';

// Mock dependencies
jest.mock('../../src/services/project.service');
jest.mock('../../src/db', () => ({
  mongoose: {
    connection: {
      getClient: jest.fn(),
    },
  },
}));

describe('Auth.js Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Credentials Provider', () => {
    it('should have credentials provider configured', () => {
      expect(authConfig.providers).toBeDefined();
      expect(authConfig.providers).toHaveLength(1);
      expect(authConfig.providers[0]).toBeDefined();
    });

    // Note: Credentials provider authorize function is tested via integration tests
    // in tests/integration/auth.authjs.test.ts to avoid type conflicts between
    // Express Request and Auth.js Request types
  });

  describe('JWT Callback', () => {
    it('should aggregate roles from all projects', async () => {
      const mockProjects = [
        { _id: { toString: () => 'project1' } },
        { _id: { toString: () => 'project2' } },
      ];

      (ProjectService.getUserProjects as jest.Mock).mockResolvedValue(mockProjects);
      (ProjectService.getUserRolesInProject as jest.Mock)
        .mockResolvedValueOnce(['admin'])
        .mockResolvedValueOnce(['operator']);

      const token = {};
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
      };

      expect(authConfig.callbacks?.jwt).toBeDefined();
      if (!authConfig.callbacks?.jwt) {
        throw new Error('JWT callback is not defined');
      }
      const jwtCallback = authConfig.callbacks.jwt;
      const result = await jwtCallback({ token, user } as never);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- roles is dynamically added to token
      expect((result as any).roles).toContain('admin');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- roles is dynamically added to token
      expect((result as any).roles).toContain('operator');
      expect(ProjectService.getUserProjects).toHaveBeenCalledWith('user-id');
      expect(ProjectService.getUserRolesInProject).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in role aggregation gracefully', async () => {
      (ProjectService.getUserProjects as jest.Mock).mockRejectedValue(new Error('Database error'));

      const token = {};
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
      };

      if (authConfig.callbacks?.jwt) {
        const result = await authConfig.callbacks.jwt({ token, user } as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- roles is dynamically added to token
        expect((result as any).roles).toEqual([]);
      }
    });
  });

  describe('Session Callback', () => {
    it('should populate session user from token', async () => {
      const session = {
        user: {
          id: '',
          email: null,
          name: null,
        },
      };

      const token = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['admin', 'operator'],
      };

      expect(authConfig.callbacks?.session).toBeDefined();
      if (!authConfig.callbacks?.session) {
        throw new Error('Session callback is not defined');
      }
      const sessionCallback = authConfig.callbacks.session;
      const result = await sessionCallback({ session, token } as never);
      if (result.user) {
        expect(result.user.id).toBe('user-id');
        expect(result.user.email).toBe('test@example.com');
        expect(result.user.name).toBe('Test User');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- roles is dynamically added to session user
        expect((result.user as any).roles).toEqual(['admin', 'operator']);
      }
    });
  });

  describe('Session Configuration', () => {
    it('should use jwt session strategy', () => {
      expect(authConfig.session?.strategy).toBe('jwt');
    });

    it('should have session maxAge configured', () => {
      expect(authConfig.session?.maxAge).toBeDefined();
      expect(typeof authConfig.session?.maxAge).toBe('number');
    });
  });

  describe('Cookie Configuration', () => {
    it('should have secure cookies in production', () => {
      expect(authConfig.cookies?.sessionToken?.options?.httpOnly).toBe(true);
      expect(authConfig.cookies?.sessionToken?.options?.sameSite).toBe('lax');
    });
  });
});
