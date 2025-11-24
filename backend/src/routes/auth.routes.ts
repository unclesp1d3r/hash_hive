import express from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { ProjectService } from '../services/project.service';
import { authenticateSession } from '../middleware/auth.middleware';
import { aggregateUserRoles } from '../utils/role-aggregator';
import { config } from '../config';
import { AppError } from '../middleware/error-handler';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Apply rate limiting to sensitive auth endpoints
const RATE_LIMIT_WINDOW_MINUTES = 1;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const RATE_LIMIT_MAX_REQUESTS = 5;

const loginRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MINUTES * MINUTES_TO_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many login attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const HTTP_UNAUTHORIZED = 401;
// Minimum password length allowed for login. Set to 8 to permit legacy accounts
// with weaker passwords while encouraging upgrade to STRONG_MIN_PASSWORD_LENGTH.
const MIN_PASSWORD_LENGTH = 8;
// Strong minimum length enforced for new password creation/update (future endpoints)
export const STRONG_MIN_PASSWORD_LENGTH = 12;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { user, token } = await AuthService.login(email, password);

    // Create session
    const sessionId = await AuthService.createSession(user._id.toString());

    // Set HttpOnly session cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: config.server.isProduction,
      sameSite: 'lax',
      maxAge: config.auth.sessionMaxAge,
    });

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        status: user.status,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        password_requires_upgrade: user.password_requires_upgrade === true,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(error);
      return;
    }

    if (error instanceof Error && error.message === 'Invalid credentials') {
      next(
        new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password', HTTP_UNAUTHORIZED)
      );
      return;
    }

    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout and clear session
 */
router.post('/logout', authenticateSession, async (req, res, next) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access -- Express cookies are typed as any
    const sessionId = req.cookies?.sessionId as string | undefined;
    if (sessionId !== undefined && sessionId !== '') {
      await AuthService.logout(sessionId);
    }

    res.clearCookie('sessionId');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Get current user with projects and roles
 */
router.get('/me', authenticateSession, async (req, res, next) => {
  try {
    const { user } = req;
    if (user === undefined) {
      throw new AppError('AUTH_SESSION_INVALID', 'User not found in session', HTTP_UNAUTHORIZED);
    }
    const projects = await ProjectService.getUserProjects(user.id);
    const projectsWithRoles = await Promise.all(
      projects.map(async (project) => {
        const roles = await ProjectService.getUserRolesInProject(user.id, project._id.toString());
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
      user: req.user,
      projects: projectsWithRoles,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', authenticateSession, async (req, res, next) => {
  try {
    if (req.user === undefined) {
      throw new AppError('AUTH_SESSION_INVALID', 'User not found in session', HTTP_UNAUTHORIZED);
    }

    // Get user roles from projects using shared helper
    const roles = await aggregateUserRoles(req.user.id);

    // Generate new token
    const token = AuthService.generateToken(req.user.id, roles);

    res.json({ token });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
