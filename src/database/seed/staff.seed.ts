import { eq } from 'drizzle-orm';
import { StaffRole } from '@common/constants/app.constants';
import { HashUtil } from '@common/utils/hash.util';
import { DrizzleDB } from '../database.provider';
import { staffUsers, StaffUser } from '../schema/staff-users.schema';

export interface ISeededStaff {
  master: StaffUser;
  managers: StaffUser[];
  runners: StaffUser[];
}

/** Development password for every seeded account. Never used in production. */
export const SEED_PASSWORD = 'Password123!';

/**
 * Seeds the staff hierarchy: one master, two managers, two runners each.
 *
 * Two managers with runners apiece is the minimum shape that makes scope
 * bugs visible: with a single manager, a broken predicate that returns
 * everything looks identical to one that returns the right rows.
 *
 * Idempotent — existing accounts are reused, so `npm run db:seed` can be
 * re-run against a populated database.
 */
export async function seedStaff(db: DrizzleDB): Promise<ISeededStaff> {
  const passwordHash = await HashUtil.hashPassword(SEED_PASSWORD);

  const upsert = async (
    email: string,
    username: string,
    role: StaffRole,
    parentId: string | null,
    firstName: string,
    lastName: string,
  ): Promise<StaffUser> => {
    const existing = await db.select().from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
    if (existing[0]) return existing[0];

    const inserted = await db
      .insert(staffUsers)
      .values({
        email,
        username,
        passwordHash,
        role,
        parentId,
        firstName,
        lastName,
        // Seeded accounts are for development, so skip the forced change
        // that a real staff-created account would carry.
        mustChangePassword: false,
      })
      .returning();
    return inserted[0];
  };

  const master = await upsert(
    'master@sambehen.local',
    'master',
    StaffRole.MASTER,
    null,
    'Morgan',
    'Master',
  );

  const managers: StaffUser[] = [];
  const runners: StaffUser[] = [];

  for (let m = 1; m <= 2; m += 1) {
    const manager = await upsert(
      `manager${m}@sambehen.local`,
      `manager${m}`,
      StaffRole.MANAGER,
      master.id,
      `Manager${m}`,
      'Lead',
    );
    managers.push(manager);

    for (let r = 1; r <= 2; r += 1) {
      runners.push(
        await upsert(
          `runner${m}${r}@sambehen.local`,
          `runner${m}${r}`,
          StaffRole.RUNNER,
          manager.id,
          `Runner${m}${r}`,
          'Field',
        ),
      );
    }
  }

  return { master, managers, runners };
}
