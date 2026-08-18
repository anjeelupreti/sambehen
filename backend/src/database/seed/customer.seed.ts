import { eq } from 'drizzle-orm';
import { CustomerStatus } from '@common/constants/app.constants';
import { HashUtil } from '@common/utils/hash.util';
import { DrizzleDB } from '../database.provider';
import { customers, Customer } from '../schema/customers.schema';
import { ISeededStaff, SEED_PASSWORD } from './staff.seed';

const CITIES = ['Kathmandu', 'Pokhara', 'Lalitpur', 'Biratnagar', 'Bhaktapur', 'Birgunj'];

const PENDING_NAMES = [
  { username: 'newplayer1', fullName: 'Alex Rivera' },
  { username: 'newplayer2', fullName: 'Sam Chen' },
  { username: 'newplayer3', fullName: 'Jordan Blake' },
];

/**
 * Seeds customers spread across the hierarchy.
 *
 * Deliberately mixes ownership and status so scope and filter tests have
 * something to bite on: most customers belong to stores, a few are owned
 * directly by a manager (storeId null), statuses and activity dates vary
 * so the active/inactive/suspended/banned filters each return a
 * non-trivial set, and a few are self-registered `pending` accounts with
 * no owner at all — so the master's approval queue (`/customers?status=
 * pending`) is never empty on a fresh seed.
 *
 * Ownership columns are written the way CustomerAssignmentService would,
 * since the database CHECK constraint enforces their consistency.
 */
export async function seedCustomers(db: DrizzleDB, staff: ISeededStaff): Promise<Customer[]> {
  const passwordHash = await HashUtil.hashPassword(SEED_PASSWORD);
  const seeded: Customer[] = [];
  const now = Date.now();

  let index = 0;

  const upsert = async (
    email: string,
    username: string,
    ownership: { ownerStaffId: string; managerId: string; storeId: string | null },
    status: CustomerStatus,
    daysSinceActivity: number,
  ): Promise<void> => {
    const existing = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (existing[0]) {
      seeded.push(existing[0]);
      return;
    }

    const [created] = await db
      .insert(customers)
      .values({
        email,
        username,
        passwordHash,
        fullName: `Customer ${index}`,
        phone: `+97798${String(10000000 + index).slice(-8)}`,
        city: CITIES[index % CITIES.length],
        country: 'Nepal',
        ...ownership,
        status,
        lastActivityAt: new Date(now - daysSinceActivity * 86_400_000),
        createdByStaffId: ownership.ownerStaffId,
      })
      .returning();
    seeded.push(created);
  };

  // Store-owned customers: five per store. Status cycles through active,
  // inactive, suspended and banned so every filter has real rows to match,
  // not just "everything is active".
  for (const store of staff.stores) {
    for (let c = 0; c < 5; c += 1) {
      index += 1;
      const status =
        index % 13 === 0
          ? CustomerStatus.BANNED
          : index % 11 === 0
            ? CustomerStatus.SUSPENDED
            : index % 5 === 0
              ? CustomerStatus.INACTIVE
              : CustomerStatus.ACTIVE;

      await upsert(
        `customer${index}@example.com`,
        `customer${index}`,
        {
          ownerStaffId: store.id,
          managerId: store.parentId as string,
          storeId: store.id,
        },
        status,
        index % 4 === 0 ? 60 : 3,
      );
    }
  }

  // Manager-owned customers, with no store in the chain. These are the
  // rows that catch a scope predicate written against storeId alone.
  for (const manager of staff.managers) {
    for (let c = 0; c < 2; c += 1) {
      index += 1;
      await upsert(
        `customer${index}@example.com`,
        `customer${index}`,
        { ownerStaffId: manager.id, managerId: manager.id, storeId: null },
        CustomerStatus.ACTIVE,
        index % 3 === 0 ? 45 : 1,
      );
    }
  }

  // Pending self-registrations: no owner at all yet — `RegisterCustomerDto`
  // never sets one, and `chk_customers_ownership` forbids setting one while
  // status is pending. Written directly rather than through
  // `AuthService.registerCustomer` so seeding stays a pure DB operation
  // with no HTTP round trip, but the shape matches what that endpoint
  // actually produces.
  //
  // Deliberately NOT added to the returned list: a pending customer has no
  // owner and cannot sign in, so it should never receive a transaction, a
  // VIP qualification or a spin win — the seeders further down the chain
  // only see customers that could plausibly have that activity.
  for (const { username, fullName } of PENDING_NAMES) {
    const email = `${username}@example.com`;
    const existing = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (existing[0]) continue;

    await db.insert(customers).values({
      email,
      username,
      passwordHash,
      fullName,
      status: CustomerStatus.PENDING,
      ownerStaffId: null,
      managerId: null,
      storeId: null,
      createdByStaffId: null,
    });
  }

  return seeded;
}
