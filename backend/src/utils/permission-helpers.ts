import type { User } from '../../../shared/src/types';
import { ProjectService } from '../services/project.service';

/**
 * Check if user can view a project
 */
export async function canViewProject(user: User, projectId: string): Promise<boolean> {
  return await ProjectService.validateProjectAccess(user.id, projectId);
}

/**
 * Check if user can manage campaigns in a project
 */
export async function canManageCampaign(user: User, projectId: string): Promise<boolean> {
  const roles = await ProjectService.getUserRolesInProject(user.id, projectId);
  return roles.includes('admin') || roles.includes('operator');
}

/**
 * Check if user can manage agents in a project
 */
export async function canManageAgents(user: User, projectId: string): Promise<boolean> {
  const roles = await ProjectService.getUserRolesInProject(user.id, projectId);
  return roles.includes('admin') || roles.includes('agent_owner');
}

/**
 * Check if user is project admin
 */
export async function isProjectAdmin(user: User, projectId: string): Promise<boolean> {
  const roles = await ProjectService.getUserRolesInProject(user.id, projectId);
  return roles.includes('admin');
}

/**
 * Check if user can access a resource type in a project
 */
export async function canAccessResource(
  user: User,
  projectId: string,
  resourceType: 'hash_list' | 'word_list' | 'rule_list' | 'mask_list'
): Promise<boolean> {
  const roles = await ProjectService.getUserRolesInProject(user.id, projectId);

  // Admin and operator can access all resources
  if (roles.includes('admin') || roles.includes('operator')) {
    return true;
  }

  // Analyst can view resources
  if (roles.includes('analyst')) {
    return true;
  }

  // Agent owner has limited access
  if (roles.includes('agent_owner')) {
    return (
      resourceType === 'word_list' || resourceType === 'rule_list' || resourceType === 'mask_list'
    );
  }

  return false;
}
