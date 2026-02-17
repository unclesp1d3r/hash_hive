import postgres from 'postgres';

export const TEST_USER = {
  email: 'test@hashhive.local',
  password: 'TestPassword123!',
  name: 'Test User',
} as const;

export const TEST_PROJECT = {
  name: 'Test Project',
  slug: 'test-project',
} as const;

/**
 * Seeds the test database with a user, project, and project membership.
 * Uses Bun.password.hash for bcrypt hashing (same as the backend auth service).
 */
export async function seedTestData(databaseUrl: string): Promise<{
  userId: number;
  projectId: number;
}> {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const passwordHash = await Bun.password.hash(TEST_USER.password, {
      algorithm: 'bcrypt',
      cost: 12,
    });

    // Insert user
    const [user] = await sql`
      INSERT INTO users (email, password_hash, name, status)
      VALUES (${TEST_USER.email}, ${passwordHash}, ${TEST_USER.name}, 'active')
      RETURNING id
    `;
    const userId = user!.id as number;

    // Insert project
    const [project] = await sql`
      INSERT INTO projects (name, slug, created_by)
      VALUES (${TEST_PROJECT.name}, ${TEST_PROJECT.slug}, ${userId})
      RETURNING id
    `;
    const projectId = project!.id as number;

    // Insert project membership with admin role
    await sql`
      INSERT INTO project_users (user_id, project_id, roles)
      VALUES (${userId}, ${projectId}, ${sql.array(['admin'])})
    `;

    return { userId, projectId };
  } finally {
    await sql.end();
  }
}
