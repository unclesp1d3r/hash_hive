/**
 * Integration test mock for @auth/express
 * Implements actual route handlers for /auth/signin/credentials and /auth/signout
 * Uses the real User model to test actual authentication flow
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import { User } from '@/models/user.model';
import { ProjectService } from '@/services/project.service';
import * as crypto from 'node:crypto';

// Mock session storage (in-memory for tests)
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const SESSION_COOKIE_NAME = 'authjs.session-token';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; /**
 * Generate a 32-byte random hex string to use as a session token.
 *
 * @returns A 64-character hexadecimal string used as the session token
 */

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new in-memory session for the given user and return its token.
 *
 * Stores a session record keyed by the returned token containing the `userId`
 * and an `expiresAt` timestamp equal to now plus `SESSION_MAX_AGE_MS`.
 *
 * @param userId - The identifier of the user to associate with the session
 * @returns The generated session token
 */
function createSession(userId: string): string {
  const token = generateSessionToken();
  sessions.set(token, {
    userId,
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  });
  return token;
}

/**
 * Extracts a session token from the request cookies, validates it, and returns the associated user id.
 *
 * If the token exists but the session is expired, the session is removed from the in-memory store.
 *
 * @param req - The incoming Express request whose Cookie header will be inspected for the session token
 * @returns `{ userId: string }` with the session's user id if a valid, non-expired session exists, `null` otherwise
 */
function getSessionFromCookie(req: Request): { userId: string } | null {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match || !match[1]) return null;

  const token = match[1];
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) {
      sessions.delete(token);
    }
    return null;
  }

  return { userId: session.userId };
}

export const getSession = async (
  req: Request
): Promise<{ user: { id: string; email: string; name: string; roles: string[] } } | null> => {
  const session = getSessionFromCookie(req);
  if (!session) return null;

  const user = await User.findById(session.userId);
  if (!user) return null;

  const roles = await ProjectService.getUserProjects(session.userId)
    .then((projects) =>
      Promise.all(
        projects.map((p) => ProjectService.getUserRolesInProject(session.userId, p._id.toString()))
      )
    )
    .then((roleArrays) => Array.from(new Set(roleArrays.flat())));

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      roles,
    },
  };
};

export const ExpressAuth = (_config: unknown) => {
  const router = express.Router();

  // POST /auth/signin/credentials
  router.post(
    '/signin/credentials',
    express.json(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email, password } = req.body;

        if (typeof email !== 'string' || typeof password !== 'string') {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        // Use the real User model to authenticate (same logic as auth.config.ts)
        const user = await User.findOne({ email: email.toLowerCase() }).select(
          '+password_hash +password_requires_upgrade'
        );

        if (!user) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        if (user.status !== 'active') {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        // Flag weak passwords for upgrade (same logic as auth.config.ts)
        const STRONG_MIN_PASSWORD_LENGTH = 12;
        if (
          password.length < STRONG_MIN_PASSWORD_LENGTH &&
          user.password_requires_upgrade !== true
        ) {
          user.password_requires_upgrade = true;
        }

        // Update last login timestamp
        user.last_login_at = new Date();
        // Save once with both updates
        await user.save();

        const userId = user._id.toString();
        const sessionToken = createSession(userId);

        res.cookie(SESSION_COOKIE_NAME, sessionToken, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: false, // Allow HTTP in tests
          maxAge: SESSION_MAX_AGE_MS,
        });

        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /auth/signout
  router.post('/signout', async (req: Request, res: Response) => {
    const cookies = req.headers.cookie || '';
    const match = cookies.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match && match[1]) {
      sessions.delete(match[1]);
    }

    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    res.status(200).json({ success: true });
  });

  return router;
};