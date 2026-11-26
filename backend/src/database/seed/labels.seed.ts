import { sql } from 'drizzle-orm';
import { DrizzleDB } from '../database.provider';
import { Customer } from '../schema/customers.schema';
import { customerLabelAssignments, customerLabels } from '../schema/labels.schema';

/** Demo labels, the kind an operator would make for their own players. */
const LABELS = [
  { name: 'Regular', color: 'green' },
  { name: 'Weekend crowd', color: 'blue' },
  { name: 'Needs follow-up', color: 'amber' },
  { name: 'Prefers texts', color: 'purple' },
];

/**
 * Seeds the label set and puts labels on some players, so the inbox
 * filters have something to show. Idempotent: existing labels and
 * assignments are left as they are.
 */
export async function seedLabels(
  db: DrizzleDB,
  masterId: string,
  seeded: Customer[],
): Promise<{ labels: number; assignments: number }> {
  for (const label of LABELS) {
    await db
      .insert(customerLabels)
      .values({ ...label, createdByStaffId: masterId })
      .onConflictDoNothing();
  }
  const rows = await db.select().from(customerLabels);
  const byName = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));

  const players = seeded.filter((customer) => customer.status !== 'pending');
  const values: (typeof customerLabelAssignments.$inferInsert)[] = [];
  players.forEach((customer, index) => {
    if (index % 2 === 0) values.push({ customerId: customer.id, labelId: byName.get('regular')! });
    if (index % 5 === 1)
      values.push({ customerId: customer.id, labelId: byName.get('weekend crowd')! });
    if (index % 7 === 3)
      values.push({ customerId: customer.id, labelId: byName.get('needs follow-up')! });
    if (index % 6 === 4)
      values.push({ customerId: customer.id, labelId: byName.get('prefers texts')! });
  });
  if (values.length) {
    await db
      .insert(customerLabelAssignments)
      .values(values.map((value) => ({ ...value, assignedByStaffId: masterId })))
      .onConflictDoNothing();
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerLabelAssignments);
  return { labels: rows.length, assignments: Number(count) };
}
