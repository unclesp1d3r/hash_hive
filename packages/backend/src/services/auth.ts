import { projects, projectUsers, users } from '@hashhive/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';

/** Checks if a user is a member of a project. Returns the membership row or null. */
export async function findProjectMembership(userId: number, projectId: number) {
  const [membership] = await db
    .select()
    .from(projectUsers)
    .where(and(eq(projectUsers.userId, userId), eq(projectUsers.projectId, projectId)))
    .limit(1);
  return membership ?? null;
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
