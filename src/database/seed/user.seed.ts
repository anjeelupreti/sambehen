import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

/**
 * Seed users helper.
 */
export async function seedUsers(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('👤 Seeding users...');

  // Simple user seed data
  const usersToSeed = [
    {
      email: 'admin@dpay.com',
      username: 'admin',
      // password is 'AdminPassword123!' hashed using bcrypt (or sample hash)
      passwordHash: '$2b$10$EPfF6c9sOihHwSgpeCozvO4v.1b2aI7gM0g2/c4PjZ3Y0eY8bQdRy',
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
    },
    {
      email: 'user@dpay.com',
      username: 'user',
      // password is 'UserPassword123!' hashed
      passwordHash: '$2b$10$EPfF6c9sOihHwSgpeCozvO4v.1b2aI7gM0g2/c4PjZ3Y0eY8bQdRy',
      firstName: 'John',
      lastName: 'Doe',
      role: 'user',
      isActive: true,
      isEmailVerified: true,
    },
  ];

  for (const user of usersToSeed) {
    // Check if user already exists
    const existing = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, user.email),
    });

    if (!existing) {
      await db.insert(schema.users).values(user);
      console.log(`Inserted user: ${user.email}`);
    } else {
      console.log(`User already exists: ${user.email}`);
    }
  }
}
