import { ProjectService } from '../services/project.service';

/**
 * Aggregate all roles for a user across all projects
 * Returns a de-duplicated array of role strings
 */
export async function aggregateUserRoles(userId: string): Promise<string[]> {
  const projects = await ProjectService.getUserProjects(userId);
  const allRoles: string[] = [];

  // Collect roles from all projects (must await sequentially to avoid race conditions)
  for (const project of projects) {
    // eslint-disable-next-line no-await-in-loop -- Need to await each project's roles before continuing
    const roles = await ProjectService.getUserRolesInProject(userId, project._id.toString());
    allRoles.push(...roles);
  }

  // De-duplicate roles
  return Array.from(new Set(allRoles));
}
