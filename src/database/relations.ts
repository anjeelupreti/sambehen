import { relations } from 'drizzle-orm';
import { users } from './schema';

/**
 * Drizzle ORM relation definitions.
 * Add relations here as new schemas are added.
 *
 * Example — when you add a `posts` table:
 *   export const usersRelations = relations(users, ({ many }) => ({
 *     posts: many(posts),
 *   }));
 *
 *   export const postsRelations = relations(posts, ({ one }) => ({
 *     author: one(users, { fields: [posts.authorId], references: [users.id] }),
 *   }));
 */
export const usersRelations = relations(users, () => ({
  // Add relations as your schema grows
}));
