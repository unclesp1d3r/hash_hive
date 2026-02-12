import { projects, projectUsers, users } from '@hashhive/shared';
import { eq } from 'drizzle-orm';
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
}): Promise<string> {
  return new SignJWT({ sub: String(payload.userId), email: payload.email, type: payload.type })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRY)
    .sign(jwtSecret);
}

export async function validateToken(token: string): Promise<{
  userId: number;
  email: string;
  type: 'session' | 'agent';
} | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    return {
      userId: Number(payload['sub']),
      email: payload['email'] as string,
      type: payload['type'] as 'session' | 'agent',
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

  const token = await createToken({ userId: user.id, email: user.email, type: 'session' });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    },
    token,
  };
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
