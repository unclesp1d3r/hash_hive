import { logger } from '../utils/logger';
import { Project, type IProject } from '../models/project.model';
import { ProjectUser } from '../models/project-user.model';
import type { UserRole } from '../../../shared/src/types';

const DEFAULT_PRIORITY = 5;
const DEFAULT_MAX_AGENTS = 100;
const NO_DELETED_COUNT = 0;

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Service class pattern for static methods
export class ProjectService {
  /**
   * Create a new project and add creator as admin
   */
  static async createProject(
    userId: string,
    data: {
      name: string;
      description?: string;
      settings?: { default_priority?: number; max_agents?: number };
    }
  ): Promise<IProject> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Project.create accepts string for ObjectId fields, type assertion needed
    const project = await Project.create({
      name: data.name,
      description: data.description,
      settings: {
        default_priority: data.settings?.default_priority ?? DEFAULT_PRIORITY,
        max_agents: data.settings?.max_agents ?? DEFAULT_MAX_AGENTS,
      },
      created_by: userId,
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Array index 0 for Parameters type
    } as unknown as Parameters<typeof Project.create>[0]);

    // Add creator as admin
    await ProjectUser.create({
      user_id: userId,
      project_id: project._id,
      roles: ['admin'],
    });

    const projectIdString = project._id.toString();
    logger.info({ userId, projectId: projectIdString }, 'Project created');

    return project;
  }

  /**
   * Get all projects for a user
   */
  static async getUserProjects(userId: string): Promise<IProject[]> {
    const projectUsers = await ProjectUser.find({ user_id: userId }).populate('project_id');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- populate returns IProject
    return projectUsers.map((pu) => pu.project_id as IProject);
  }

  /**
   * Add user to project with roles
   */
  static async addUserToProject(
    projectId: string,
    userId: string,
    roles: UserRole[]
  ): Promise<void> {
    const existing = await ProjectUser.findOne({ user_id: userId, project_id: projectId });
    if (existing !== null) {
      throw new Error('User is already a member of this project');
    }

    await ProjectUser.create({
      user_id: userId,
      project_id: projectId,
      roles,
    });

    logger.info({ userId, projectId, roles }, 'User added to project');
  }

  /**
   * Remove user from project
   */
  static async removeUserFromProject(projectId: string, userId: string): Promise<void> {
    const result = await ProjectUser.deleteOne({ user_id: userId, project_id: projectId });
    if (result.deletedCount === NO_DELETED_COUNT) {
      throw new Error('User is not a member of this project');
    }

    logger.info({ userId, projectId }, 'User removed from project');
  }

  /**
   * Validate user has access to project
   */
  static async validateProjectAccess(
    userId: string,
    projectId: string,
    requiredRole?: UserRole
  ): Promise<boolean> {
    const projectUser = await ProjectUser.findOne({ user_id: userId, project_id: projectId });

    if (projectUser === null) {
      return false;
    }

    if (requiredRole !== undefined) {
      return projectUser.roles.includes(requiredRole);
    }

    return true;
  }

  /**
   * Get user roles in a project
   */
  static async getUserRolesInProject(userId: string, projectId: string): Promise<UserRole[]> {
    const projectUser = await ProjectUser.findOne({ user_id: userId, project_id: projectId });
    return projectUser?.roles ?? [];
  }
}
