import { ProjectService } from '../../src/services/project.service';
import { Project } from '../../src/models/project.model';
import { ProjectUser } from '../../src/models/project-user.model';

// Mock dependencies
jest.mock('../../src/models/project.model');
jest.mock('../../src/models/project-user.model');

describe('ProjectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create project and add creator as admin', async () => {
      const mockProject = {
        _id: { toString: () => 'project123' },
        name: 'Test Project',
        description: 'Test Description',
        slug: 'test-project',
        created_by: 'user123',
      };

      (Project.create as jest.Mock).mockResolvedValue(mockProject);
      (ProjectUser.create as jest.Mock).mockResolvedValue({});

      const result = await ProjectService.createProject('user123', {
        name: 'Test Project',
        description: 'Test Description',
      });

      expect(result).toBe(mockProject);
      expect(Project.create).toHaveBeenCalled();
      expect(ProjectUser.create).toHaveBeenCalledWith({
        user_id: 'user123',
        project_id: mockProject._id,
        roles: ['admin'],
      });
    });
  });

  describe('getUserProjects', () => {
    it('should return all projects for user', async () => {
      const mockProject = {
        _id: { toString: () => 'project123' },
        name: 'Test Project',
      };

      const mockProjectUser = {
        project_id: mockProject,
      };

      (ProjectUser.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockProjectUser]),
      });

      const projects = await ProjectService.getUserProjects('user123');

      expect(projects).toHaveLength(1);
      expect(projects[0]).toBe(mockProject);
    });
  });

  describe('addUserToProject', () => {
    it('should create ProjectUser entry', async () => {
      (ProjectUser.findOne as jest.Mock).mockResolvedValue(null);
      (ProjectUser.create as jest.Mock).mockResolvedValue({});

      await ProjectService.addUserToProject('project123', 'user123', ['operator']);

      expect(ProjectUser.create).toHaveBeenCalledWith({
        user_id: 'user123',
        project_id: 'project123',
        roles: ['operator'],
      });
    });

    it('should throw error if user already in project', async () => {
      (ProjectUser.findOne as jest.Mock).mockResolvedValue({});

      await expect(
        ProjectService.addUserToProject('project123', 'user123', ['operator'])
      ).rejects.toThrow('User is already a member of this project');
    });
  });

  describe('removeUserFromProject', () => {
    it('should delete ProjectUser entry', async () => {
      (ProjectUser.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      await ProjectService.removeUserFromProject('project123', 'user123');

      expect(ProjectUser.deleteOne).toHaveBeenCalledWith({
        user_id: 'user123',
        project_id: 'project123',
      });
    });

    it('should throw error if user not in project', async () => {
      (ProjectUser.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 0 });

      await expect(ProjectService.removeUserFromProject('project123', 'user123')).rejects.toThrow(
        'User is not a member of this project'
      );
    });
  });

  describe('validateProjectAccess', () => {
    it('should return true with valid access', async () => {
      const mockProjectUser = {
        roles: ['admin', 'operator'],
      };

      (ProjectUser.findOne as jest.Mock).mockResolvedValue(mockProjectUser);

      const hasAccess = await ProjectService.validateProjectAccess('user123', 'project123');

      expect(hasAccess).toBe(true);
    });

    it('should return false with no access', async () => {
      (ProjectUser.findOne as jest.Mock).mockResolvedValue(null);

      const hasAccess = await ProjectService.validateProjectAccess('user123', 'project123');

      expect(hasAccess).toBe(false);
    });

    it('should validate role requirement', async () => {
      const mockProjectUser = {
        roles: ['operator'],
      };

      (ProjectUser.findOne as jest.Mock).mockResolvedValue(mockProjectUser);

      const hasAccess = await ProjectService.validateProjectAccess(
        'user123',
        'project123',
        'admin'
      );

      expect(hasAccess).toBe(false);

      const hasOperatorAccess = await ProjectService.validateProjectAccess(
        'user123',
        'project123',
        'operator'
      );

      expect(hasOperatorAccess).toBe(true);
    });
  });

  describe('getUserRolesInProject', () => {
    it('should return array of roles', async () => {
      const mockProjectUser = {
        roles: ['admin', 'operator'],
      };

      (ProjectUser.findOne as jest.Mock).mockResolvedValue(mockProjectUser);

      const roles = await ProjectService.getUserRolesInProject('user123', 'project123');

      expect(roles).toEqual(['admin', 'operator']);
    });

    it('should return empty array if user not in project', async () => {
      (ProjectUser.findOne as jest.Mock).mockResolvedValue(null);

      const roles = await ProjectService.getUserRolesInProject('user123', 'project123');

      expect(roles).toEqual([]);
    });
  });
});
