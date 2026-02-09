import type { NextFunction, Request, Response } from 'express';
import {
  hasPermission,
  requireProjectAccess,
  requireProjectRole,
  requireRole,
} from '../../src/middleware/authz.middleware';
import { AppError } from '../../src/middleware/error-handler';
import { Project } from '../../src/models/project.model';
import { Role } from '../../src/models/role.model';
import { ProjectService } from '../../src/services/project.service';

// Mock dependencies
jest.mock('../../src/services/project.service');
jest.mock('../../src/models/project.model');
jest.mock('../../src/models/role.model');

describe('Authorization Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      id: 'test-request-id',
      user: {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      params: {},
      query: {},
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('requireRole', () => {
    it('should call next when user has required role', () => {
      mockReq.user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['admin', 'operator'],
      };

      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next when user has one of multiple required roles', () => {
      mockReq.user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['operator'],
      };

      const middleware = requireRole('admin', 'operator');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when user lacks required role', () => {
      mockReq.user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['analyst'],
      };

      const middleware = requireRole('admin');

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);

      const error = (() => {
        try {
          middleware(mockReq as Request, mockRes as Response, mockNext);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).toBeInstanceOf(AppError);
      if (error instanceof AppError) {
        expect(error.code).toBe('AUTHZ_INSUFFICIENT_PERMISSIONS');
        expect(error.statusCode).toBe(403);
      }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user has no roles', () => {
      mockReq.user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: [],
      };

      const middleware = requireRole('admin');

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user roles are undefined', () => {
      mockReq.user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const middleware = requireRole('admin');

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when no user', () => {
      mockReq.user = undefined as any;
      const middleware = requireRole('admin');

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireProjectAccess', () => {
    it('should attach project to req.project and call next with valid access', async () => {
      const mockProject = {
        _id: { toString: () => 'project123' },
        name: 'Test Project',
      };

      mockReq.params = { projectId: 'project123' };

      (ProjectService.validateProjectAccess as jest.Mock).mockResolvedValue(true);
      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      const middleware = requireProjectAccess('projectId');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.project).toBe(mockProject);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 with no access', async () => {
      mockReq.params = { projectId: 'project123' };

      (ProjectService.validateProjectAccess as jest.Mock).mockResolvedValue(false);

      const middleware = requireProjectAccess('projectId');

      await expect(middleware(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(
        AppError
      );

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireProjectRole', () => {
    it('should call next when user has required role in project', async () => {
      const mockProject = {
        _id: { toString: () => 'project123' },
        name: 'Test Project',
      };

      mockReq.params = { projectId: 'project123' };

      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['admin', 'operator']);
      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      const middleware = requireProjectRole('projectId', 'admin');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when user lacks required role', async () => {
      mockReq.params = { projectId: 'project123' };

      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['analyst']);

      const middleware = requireProjectRole('projectId', 'admin');

      await expect(middleware(mockReq as Request, mockRes as Response, mockNext)).rejects.toThrow(
        AppError
      );

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission through one of their roles', async () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['admin', 'operator'],
      };

      const mockAdminRole = {
        name: 'admin',
        permissions: ['project:read', 'project:write', 'campaign:create'],
      };

      const mockOperatorRole = {
        name: 'operator',
        permissions: ['campaign:start', 'campaign:stop'],
      };

      (Role.find as jest.Mock).mockResolvedValue([mockAdminRole, mockOperatorRole]);

      const result = await hasPermission(user, 'campaign:create');

      expect(result).toBe(true);
      expect(Role.find).toHaveBeenCalledWith({ name: { $in: ['admin', 'operator'] } });
    });

    it('should return true when user has permission through multiple roles', async () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['admin', 'operator'],
      };

      const mockAdminRole = {
        name: 'admin',
        permissions: ['project:read'],
      };

      const mockOperatorRole = {
        name: 'operator',
        permissions: ['project:read'],
      };

      (Role.find as jest.Mock).mockResolvedValue([mockAdminRole, mockOperatorRole]);

      const result = await hasPermission(user, 'project:read');

      expect(result).toBe(true);
    });

    it('should return false when user lacks the permission', async () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['analyst'],
      };

      const mockAnalystRole = {
        name: 'analyst',
        permissions: ['project:read', 'campaign:view'],
      };

      (Role.find as jest.Mock).mockResolvedValue([mockAnalystRole]);

      const result = await hasPermission(user, 'campaign:create');

      expect(result).toBe(false);
    });

    it('should return false when user has no roles', async () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: [],
      };

      const result = await hasPermission(user, 'campaign:create');

      expect(result).toBe(false);
      expect(Role.find).not.toHaveBeenCalled();
    });

    it('should return false when user roles are undefined', async () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await hasPermission(user, 'campaign:create');

      expect(result).toBe(false);
      expect(Role.find).not.toHaveBeenCalled();
    });

    it('should return false when no roles found in database', async () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active' as const,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['nonexistent'],
      };

      (Role.find as jest.Mock).mockResolvedValue([]);

      const result = await hasPermission(user, 'campaign:create');

      expect(result).toBe(false);
    });
  });
});
