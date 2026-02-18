import { projects, projectUsers, users } from '@hashhive/shared';
import { and, eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env.js';
import { db } from '../db/index.js';

const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export async function createToken(payload: {
  userId: number;
  email: string;
  type: 'session' | 'agent';
  projectId?: number;
}): Promise<string> {
  const claims: Record<string, unknown> = {
    sub: String(payload.userId),
    email: payload.email,
    type: payload.type,
  };
  if (payload.projectId) {
    claims['projectId'] = payload.projectId;
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRY)
    .sign(jwtSecret);
}

export async function validateToken(token: string): Promise<{
  userId: number;
  email: string;
  type: 'session' | 'agent';
  projectId?: number;
} | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    const sub = payload['sub'];
    const email = payload['email'];
    const type = payload['type'];
    const projectId = payload['projectId'];

    if (typeof sub !== 'string' || typeof email !== 'string') {
      return null;
    }
    if (type !== 'session' && type !== 'agent') {
      return null;
    }

    return {
      userId: Number(sub),
      email,
      type,
      ...(typeof projectId === 'number' ? { projectId } : {}),
    };
  } catch {
    return null;
  }
}

// Dummy hash for constant-time comparison when user is not found
const DUMMY_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4aLQHkMAJnlCp4bu';

export async function login(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  // Update last login
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  // Check user's project memberships to auto-select if only one
  const memberships = await db
    .select({ projectId: projectUsers.projectId })
    .from(projectUsers)
    .where(eq(projectUsers.userId, user.id));

  const autoProjectId = memberships.length === 1 ? memberships[0]?.projectId : undefined;

  const token = await createToken({
    userId: user.id,
    email: user.email,
    type: 'session',
    ...(autoProjectId ? { projectId: autoProjectId } : {}),
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    },
    token,
    ...(autoProjectId ? { selectedProjectId: autoProjectId } : {}),
  };
}

export async function selectProject(userId: number, projectId: number) {
  // Validate user is member of project
  const [membership] = await db
    .select()
    .from(projectUsers)
    .where(and(eq(projectUsers.userId, userId), eq(projectUsers.projectId, projectId)))
    .limit(1);

  if (!membership) {
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return null;
  }

  const token = await createToken({
    userId: user.id,
    email: user.email,
    type: 'session',
    projectId,
  });

  return { token, projectId };
}

export async function getUserWithProjects(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return null;
  }

  const memberships = await db
    .select({
      projectId: projectUsers.projectId,
      roles: projectUsers.roles,
      projectName: projects.name,
      projectSlug: projects.slug,
    })
    .from(projectUsers)
    .innerJoin(projects, eq(projectUsers.projectId, projects.id))
    .where(eq(projectUsers.userId, userId));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    },
    projects: memberships.map((m) => ({
      id: m.projectId,
      name: m.projectName,
      slug: m.projectSlug,
      roles: m.roles,
    })),
  };
}
