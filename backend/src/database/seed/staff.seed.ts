import { eq } from 'drizzle-orm';
import { StaffRole } from '@common/constants/app.constants';
import { HashUtil } from '@common/utils/hash.util';
import { DrizzleDB } from '../database.provider';
import { staffUsers, StaffUser } from '../schema/staff-users.schema';

export interface ISeededStaff {
  master: StaffUser;
  managers: StaffUser[];
  stores: StaffUser[];
}

/** Development password for every seeded account. Never used in production. */
export const SEED_PASSWORD = 'Password123!';

/** Stores per manager — deliberately uneven, so a scope bug that leaks a
 * fixed count (e.g. always 2) looks wrong immediately instead of matching
 * every manager by coincidence. */
const STORE_COUNTS = [3, 2, 1];

/**
 * Seeds the staff hierarchy: one master, three managers, an uneven number
 * of stores under each (3/2/1).
 *
 * Three managers with different-sized teams is the shape that makes scope
 * bugs visible: with one manager, or with every manager the same size, a
 * broken predicate that returns everything (or returns a fixed slice) can
 * look identical to one that returns the right rows.
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
  const stores: StaffUser[] = [];

  for (let m = 1; m <= STORE_COUNTS.length; m += 1) {
    const manager = await upsert(
      `manager${m}@sambehen.local`,
      `manager${m}`,
      StaffRole.MANAGER,
      master.id,
      `Manager${m}`,
      'Lead',
    );
    managers.push(manager);

    const storeCount = STORE_COUNTS[m - 1];
    for (let r = 1; r <= storeCount; r += 1) {
      stores.push(
        await upsert(
          `store${m}${r}@sambehen.local`,
          `store${m}${r}`,
          StaffRole.STORE,
          manager.id,
          `Store${m}${r}`,
          'Field',
        ),
      );
    }
  }

  return { master, managers, stores };
}
