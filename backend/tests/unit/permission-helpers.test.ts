import {
  canViewProject,
  canManageCampaign,
  canManageAgents,
  isProjectAdmin,
  canAccessResource,
} from '../../src/utils/permission-helpers';
import { ProjectService } from '../../src/services/project.service';
import type { User } from '../../../shared/src/types';

// Mock ProjectService
jest.mock('../../src/services/project.service');

describe('permission-helpers', () => {
  const mockUser: User = {
    id: 'user123',
    email: 'test@example.com',
    name: 'Test User',
    status: 'active',
    last_login_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const projectId = 'project123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canViewProject', () => {
    it('should return true when user has access to project', async () => {
      (ProjectService.validateProjectAccess as jest.Mock).mockResolvedValue(true);

      const result = await canViewProject(mockUser, projectId);

      expect(result).toBe(true);
      expect(ProjectService.validateProjectAccess).toHaveBeenCalledWith(mockUser.id, projectId);
    });

    it('should return false when user does not have access to project', async () => {
      (ProjectService.validateProjectAccess as jest.Mock).mockResolvedValue(false);

      const result = await canViewProject(mockUser, projectId);

      expect(result).toBe(false);
      expect(ProjectService.validateProjectAccess).toHaveBeenCalledWith(mockUser.id, projectId);
    });
  });

  describe('canManageCampaign', () => {
    it('should return true when user is admin', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['admin']);

      const result = await canManageCampaign(mockUser, projectId);

      expect(result).toBe(true);
      expect(ProjectService.getUserRolesInProject).toHaveBeenCalledWith(mockUser.id, projectId);
    });

    it('should return true when user is operator', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['operator']);

      const result = await canManageCampaign(mockUser, projectId);

      expect(result).toBe(true);
    });

    it('should return false when user is neither admin nor operator', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['analyst']);

      const result = await canManageCampaign(mockUser, projectId);

      expect(result).toBe(false);
    });
  });

  describe('canManageAgents', () => {
    it('should return true when user is admin', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['admin']);

      const result = await canManageAgents(mockUser, projectId);

      expect(result).toBe(true);
      expect(ProjectService.getUserRolesInProject).toHaveBeenCalledWith(mockUser.id, projectId);
    });

    it('should return true when user is agent_owner', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['agent_owner']);

      const result = await canManageAgents(mockUser, projectId);

      expect(result).toBe(true);
    });

    it('should return false when user is neither admin nor agent_owner', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['operator']);

      const result = await canManageAgents(mockUser, projectId);

      expect(result).toBe(false);
    });
  });

  describe('isProjectAdmin', () => {
    it('should return true when user is admin', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['admin']);

      const result = await isProjectAdmin(mockUser, projectId);

      expect(result).toBe(true);
      expect(ProjectService.getUserRolesInProject).toHaveBeenCalledWith(mockUser.id, projectId);
    });

    it('should return false when user is not admin', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['operator']);

      const result = await isProjectAdmin(mockUser, projectId);

      expect(result).toBe(false);
    });
  });

  describe('canAccessResource', () => {
    it('should return true when user is admin', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['admin']);

      const result = await canAccessResource(mockUser, projectId, 'hash_list');

      expect(result).toBe(true);
      expect(ProjectService.getUserRolesInProject).toHaveBeenCalledWith(mockUser.id, projectId);
    });

    it('should return true when user is operator', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['operator']);

      const result = await canAccessResource(mockUser, projectId, 'hash_list');

      expect(result).toBe(true);
    });

    it('should return true when user is analyst', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['analyst']);

      const result = await canAccessResource(mockUser, projectId, 'hash_list');

      expect(result).toBe(true);
    });

    it('should return true when user is agent_owner and resource is word_list', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['agent_owner']);

      const result = await canAccessResource(mockUser, projectId, 'word_list');

      expect(result).toBe(true);
    });

    it('should return true when user is agent_owner and resource is rule_list', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['agent_owner']);

      const result = await canAccessResource(mockUser, projectId, 'rule_list');

      expect(result).toBe(true);
    });

    it('should return true when user is agent_owner and resource is mask_list', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['agent_owner']);

      const result = await canAccessResource(mockUser, projectId, 'mask_list');

      expect(result).toBe(true);
    });

    it('should return false when user is agent_owner and resource is hash_list', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue(['agent_owner']);

      const result = await canAccessResource(mockUser, projectId, 'hash_list');

      expect(result).toBe(false);
    });

    it('should return false when user has no roles', async () => {
      (ProjectService.getUserRolesInProject as jest.Mock).mockResolvedValue([]);

      const result = await canAccessResource(mockUser, projectId, 'hash_list');

      expect(result).toBe(false);
    });
  });
});
