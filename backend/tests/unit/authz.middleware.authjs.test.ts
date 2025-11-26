import type { Request, Response, NextFunction } from 'express';
import { requireRole, requireProjectAccess, requireProjectRole, hasPermission } from '../../src/middleware/authz.middleware.authjs';
import { ProjectService } from '../../src/services/project.service';
import { Project } from '../../src/models/project.model';
import { Role } from '../../src/models/role.model';
import { AppError } from '../../src/middleware/error-handler';
import type { User } from '../../../shared/src/types';

// Mock services and models
jest.mock('../../src/services/project.service');
jest.mock('../../src/models/project.model');
jest.mock('../../src/models/role.model');

describe('Auth.js Authorization Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      user: {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['admin', 'operator'],
      },
      params: {},
      query: {},
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requireRole', () => {
    it('should allow access if user has required role', () => {
      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access if user lacks required role', () => {
      const middleware = requireRole('analyst');

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw AppError if user is not authenticated', () => {
      delete mockReq.user;
      const middleware = requireRole('admin');

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireProjectAccess', () => {
    it('should allow access if user has project access', async () => {
      mockReq.params = { projectId: 'project-id' };
      (ProjectService.validateProjectAccess as jest.Mock).mockResolvedValue(true);
      (Project.findById as jest.Mock).mockResolvedValue({ _id: 'project-id', name: 'Test Project' });

      const middleware = requireProjectAccess('projectId');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(ProjectService.validateProjectAccess).toHaveBeenCalledWith('user-id', 'project-id');
      expect(mockReq.project).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access if user lacks project access', async () => {
      mockReq.params = { projectId: 'project-id' };
      (ProjectService.validateProjectAccess as jest.Mock).mockResolvedValue(false);

      const middleware = requireProjectAccess('projectId');

      await expect(
        middleware(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireProjectRole', () => {
    it('should allow access if user has required role in project', async () => {
      mockReq.params = { projectId: 'project-id' };
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['admin']);
      (Project.findById as jest.Mock).mockResolvedValue({ _id: 'project-id', name: 'Test Project' });

      const middleware = requireProjectRole('projectId', 'admin');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(ProjectService.getUserRolesInProject).toHaveBeenCalledWith('user-id', 'project-id');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access if user lacks required role in project', async () => {
      mockReq.params = { projectId: 'project-id' };
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['analyst']);

      const middleware = requireProjectRole('projectId', 'admin');

      await expect(
        middleware(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(AppError);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has permission', async () => {
      const mockUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['admin'],
      };

      (Role.find as jest.Mock).mockResolvedValue([
        {
          name: 'admin',
          permissions: ['project:read', 'project:write'],
        },
      ]);

      const result = await hasPermission(mockUser, 'project:read');

      expect(result).toBe(true);
    });

    it('should return false if user lacks permission', async () => {
      const mockUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        roles: ['analyst'],
      };

      (Role.find as jest.Mock).mockResolvedValue([
        {
          name: 'analyst',
          permissions: ['project:read'],
        },
      ]);

      const result = await hasPermission(mockUser, 'project:write');

      expect(result).toBe(false);
    });
  });
});

