import express from 'express';
import { getSession } from '@auth/express';
import { getAuthConfig } from '../config/auth.config';
import { ProjectService } from '../services/project.service';
import { AppError } from '../middleware/error-handler';

const router = express.Router();

const HTTP_UNAUTHORIZED = 401;

/**
 * GET /api/v1/web/auth/me
 * Get current user with projects and roles
 * Note: This is a custom route mounted under /api/v1/web/auth, not under /auth/*
 * Auth.js core routes (signin, signout, callback) are mounted directly in index.ts at /auth/*
 */
router.get('/me', async (req, res, next) => {
  try {
    const session = await getSession(req, getAuthConfig());

    if (session === null || typeof session !== 'object') {
      throw new AppError('AUTH_SESSION_INVALID', 'User not found in session', HTTP_UNAUTHORIZED);
    }

    const sessionWithUser = session as { user?: { id?: unknown } };
    const { user: sessionUser } = sessionWithUser;
    if (sessionUser === undefined) {
      throw new AppError('AUTH_SESSION_INVALID', 'User not found in session', HTTP_UNAUTHORIZED);
    }
    const { id: userId } = sessionUser;
    if (typeof userId !== 'string') {
      throw new AppError('AUTH_SESSION_INVALID', 'Invalid user ID in session', HTTP_UNAUTHORIZED);
    }
    const projects = await ProjectService.getUserProjects(userId);
    const projectsWithRoles = await Promise.all(
      projects.map(async (project) => {
        const projectId = project._id.toString();
        const roles = await ProjectService.getUserRolesInProject(userId, projectId);
        return {
          id: project._id.toString(),
          name: project.name,
          description: project.description,
          slug: project.slug,
          roles,
        };
      })
    );

    res.json({
      user: sessionUser,
      projects: projectsWithRoles,
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
