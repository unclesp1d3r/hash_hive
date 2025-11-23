import { ProjectService } from '../services/project.service';

/**
 * Aggregate all roles for a user across all projects
 * Returns a de-duplicated array of role strings
 */
export async function aggregateUserRoles(userId: string): Promise<string[]> {
  const projects = await ProjectService.getUserProjects(userId);

  // Collect roles from all projects in parallel
  const roleArrays = await Promise.all(
    projects.map((project) => ProjectService.getUserRolesInProject(userId, project._id.toString()))
  );

  // Flatten and de-duplicate roles
  return Array.from(new Set(roleArrays.flat()));
}
