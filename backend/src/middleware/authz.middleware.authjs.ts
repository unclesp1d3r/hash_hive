import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';
import { ProjectService } from '../services/project.service';
import { Project } from '../models/project.model';
import { Role } from '../models/role.model';
import { logger } from '../utils/logger';
import type { UserRole, User } from '../../../shared/src/types';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

/**
 * Require user to have one of the specified roles
 */
export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user === undefined) {
      throw new AppError(
        'AUTHZ_INSUFFICIENT_PERMISSIONS',
        'Authentication required',
        HTTP_FORBIDDEN
      );
    }

    // Get user roles from req.user (populated by auth middleware)
    const userRoles = req.user.roles ?? [];

    // Check if user has at least one of the required roles
    const hasRequiredRole = roles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      throw new AppError(
        'AUTHZ_INSUFFICIENT_PERMISSIONS',
        `User must have one of the following roles: ${roles.join(', ')}`,
        HTTP_FORBIDDEN
      );
    }

    next();
  };

/**
 * Require user to have access to a project
 */
export const requireProjectAccess =
  (projectIdParam = 'projectId') =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (req.user === undefined) {
      throw new AppError(
        'AUTHZ_INSUFFICIENT_PERMISSIONS',
        'Authentication required',
        HTTP_FORBIDDEN
      );
    }

    const projectId = req.params[projectIdParam] ?? req.query[projectIdParam];
    if (projectId === undefined || typeof projectId !== 'string' || projectId === '') {
      throw new AppError('AUTHZ_PROJECT_ACCESS_DENIED', 'Project ID is required', HTTP_FORBIDDEN);
    }

    const hasAccess = await ProjectService.validateProjectAccess(req.user.id, projectId);
    if (!hasAccess) {
      throw new AppError(
        'AUTHZ_PROJECT_ACCESS_DENIED',
        'Access denied to this project',
        HTTP_FORBIDDEN
      );
    }

    // Attach project to request
    const project = await Project.findById(projectId);
    if (project === null) {
      logger.warn(
        {
          projectId,
          userId: req.user.id,
          userEmail: req.user.email,
          path: req.path,
          method: req.method,
        },
        'Project not found after access validation'
      );
      next(new AppError('PROJECT_NOT_FOUND', 'Project not found', HTTP_NOT_FOUND));
      return;
    }

    // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
    req.project = project;

    next();
  };

/**
 * Require user to have a specific role in a project
 */
export const requireProjectRole =
  (projectIdParam = 'projectId', ...roles: UserRole[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (req.user === undefined) {
      throw new AppError(
        'AUTHZ_INSUFFICIENT_PERMISSIONS',
        'Authentication required',
        HTTP_FORBIDDEN
      );
    }

    const projectId = req.params[projectIdParam] ?? req.query[projectIdParam];
    if (projectId === undefined || typeof projectId !== 'string' || projectId === '') {
      throw new AppError('AUTHZ_PROJECT_ACCESS_DENIED', 'Project ID is required', HTTP_FORBIDDEN);
    }

    const userRoles = await ProjectService.getUserRolesInProject(req.user.id, projectId);
    const hasRequiredRole = roles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      throw new AppError(
        'AUTHZ_INSUFFICIENT_PERMISSIONS',
        'Insufficient permissions for this action',
        HTTP_FORBIDDEN
      );
    }

    // Attach project to request
    const project = await Project.findById(projectId);
    if (project === null) {
      logger.warn(
        {
          projectId,
          userId: req.user.id,
          userEmail: req.user.email,
          path: req.path,
          method: req.method,
        },
        'Project not found after role validation'
      );
      next(new AppError('PROJECT_NOT_FOUND', 'Project not found', HTTP_NOT_FOUND));
      return;
    }

    // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
    req.project = project;

    next();
  };

/**
 * Check if user has a specific permission
 * Queries Role model for permissions associated with user's roles
 */
export async function hasPermission(user: User, permission: string): Promise<boolean> {
  // Get user roles from req.user (populated by auth middleware)
  const userRoles = user.roles ?? [];

  const EMPTY_ARRAY_LENGTH = 0;
  if (userRoles.length === EMPTY_ARRAY_LENGTH) {
    return false;
  }

  // Query Role model for all roles the user has
  const roles = await Role.find({ name: { $in: userRoles } });

  // Collect all permissions from user's roles
  const allPermissions = new Set<string>();
  for (const role of roles) {
    role.permissions.forEach((perm) => allPermissions.add(perm));
  }

  // Check if the requested permission is present
  return allPermissions.has(permission);
}
