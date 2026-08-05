import { sql } from 'drizzle-orm';

import { DrizzleDB } from '../database.provider';
import { auditLogs, spinEvents, spinWinners, vipCriteria, vipQualifications } from '../schema';
import {
  SpinEventStatus,
  SpinSelectionMode,
  VipMetric,
} from '../../common/constants/app.constants';
import type { ISeededStaff } from './staff.seed';

/**
 * VIP criteria, spin events and the audit trail.
 *
 * Runs after transactions, because all three are *derived* from recorded
 * activity: a VIP qualifies by spending, and a spin event draws from those
 * VIPs. Seeding them from invented figures would produce a demo where the
 * numbers on screen contradict the transactions behind them.
 *
 * Idempotent like the other seeders — it clears what it owns before
 * inserting, so `db:seed` can be re-run without stacking duplicates.
 */

interface SeededCustomer {
  id: string;
  username: string;
}

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

export async function seedEngagement(
  db: DrizzleDB,
  staff: ISeededStaff,
  customers: SeededCustomer[],
): Promise<{
  criteria: number;
  qualifications: number;
  events: number;
  winners: number;
  audit: number;
}> {
  await db.execute(sql`DELETE FROM spin_winners`);
  await db.execute(sql`DELETE FROM spin_events`);
  await db.execute(sql`DELETE FROM vip_qualifications`);
  await db.execute(sql`DELETE FROM vip_criteria`);
  await db.execute(sql`DELETE FROM audit_logs`);

  const masterId = staff.master.id;

  /*
   * Real spend per customer, read back from the transactions already
   * seeded. Qualification is computed from this rather than assigned, so
   * the VIP list agrees with the transaction list.
   */
  const spendRows = await db.execute<{ customer_id: string; total_debit: string; entries: string }>(
    sql`SELECT customer_id,
               COALESCE(SUM(amount) FILTER (WHERE type = 'debit'), 0)::text AS total_debit,
               COUNT(*)::text AS entries
        FROM transactions
        GROUP BY customer_id`,
  );

  const spendByCustomer = new Map<string, number>();
  for (const row of spendRows.rows ?? []) {
    spendByCustomer.set(row.customer_id, Number(row.total_debit));
  }

  // ── VIP criteria ──────────────────────────────────────────────────────
  const criteriaRows = [
    {
      name: 'Gold — quarterly spend',
      description: 'Deposits of 5,000 or more within the current quarter.',
      tier: 2,
      metric: VipMetric.TOTAL_DEBIT,
      thresholdAmount: '5000.00',
      periodStart: isoDate(daysAgo(90)),
      periodEnd: isoDate(daysAgo(-90)),
      isActive: true,
    },
    {
      name: 'Silver — quarterly spend',
      description: 'Deposits of 1,500 or more within the current quarter.',
      tier: 1,
      metric: VipMetric.TOTAL_DEBIT,
      thresholdAmount: '1500.00',
      periodStart: isoDate(daysAgo(90)),
      periodEnd: isoDate(daysAgo(-90)),
      isActive: true,
    },
    {
      // Kept deliberately: a lapsed criteria proves the UI shows historic
      // qualifications rather than silently dropping them.
      name: 'Launch promotion (closed)',
      description: 'An earlier window, retained so past qualifications stay visible.',
      tier: 1,
      metric: VipMetric.TOTAL_DEBIT,
      thresholdAmount: '500.00',
      periodStart: isoDate(daysAgo(300)),
      periodEnd: isoDate(daysAgo(210)),
      isActive: false,
    },
  ];

  const insertedCriteria = await db
    .insert(vipCriteria)
    .values(criteriaRows.map((row) => ({ ...row, createdByStaffId: masterId })))
    .returning({
      id: vipCriteria.id,
      tier: vipCriteria.tier,
      threshold: vipCriteria.thresholdAmount,
    });

  // ── Qualifications, computed from real spend ──────────────────────────
  const qualifications: {
    criteriaId: string;
    customerId: string;
    achievedAmount: string;
    thresholdAmount: string;
    qualifiedAt: Date;
  }[] = [];

  for (const criteria of insertedCriteria) {
    const threshold = Number(criteria.threshold);

    for (const customer of customers) {
      const spend = spendByCustomer.get(customer.id) ?? 0;
      if (spend < threshold) continue;

      qualifications.push({
        criteriaId: criteria.id,
        customerId: customer.id,
        achievedAmount: spend.toFixed(2),
        thresholdAmount: criteria.threshold,
        qualifiedAt: daysAgo(Math.floor(Math.random() * 60) + 1),
      });
    }
  }

  if (qualifications.length > 0) {
    await db.insert(vipQualifications).values(qualifications);
  }

  // ── Spin events ───────────────────────────────────────────────────────
  const goldCriteria = insertedCriteria[0];
  const silverCriteria = insertedCriteria[1];

  const insertedEvents = await db
    .insert(spinEvents)
    .values([
      {
        name: 'Quarterly Gold Draw',
        description: 'Completed draw for Gold-tier customers.',
        vipCriteriaId: goldCriteria.id,
        selectionMode: SpinSelectionMode.POST_DRAW,
        status: SpinEventStatus.COMPLETED,
        scheduledAt: daysAgo(14),
        prizeDescription: 'Cash prizes for the top three.',
        prizePool: '5000.00',
        createdByStaffId: masterId,
      },
      {
        name: 'Silver Monthly Spin',
        description: 'Winners chosen ahead of the draw.',
        vipCriteriaId: silverCriteria.id,
        selectionMode: SpinSelectionMode.PRESELECTED,
        status: SpinEventStatus.COMPLETED,
        scheduledAt: daysAgo(7),
        prizeDescription: 'Bonus credit for two winners.',
        prizePool: '1200.00',
        createdByStaffId: masterId,
      },
      {
        // Upcoming, so the UI has a non-completed status to render.
        name: 'Next Gold Draw',
        description: 'Scheduled — no winners yet.',
        vipCriteriaId: goldCriteria.id,
        selectionMode: SpinSelectionMode.POST_DRAW,
        status: SpinEventStatus.SCHEDULED,
        scheduledAt: daysAgo(-21),
        prizeDescription: 'To be announced.',
        prizePool: '7500.00',
        createdByStaffId: masterId,
      },
    ])
    .returning({ id: spinEvents.id, name: spinEvents.name, status: spinEvents.status });

  // Winners are drawn from customers who actually qualified, so a winner is
  // never someone the VIP list says was ineligible.
  const qualifiedCustomerIds = [...new Set(qualifications.map((q) => q.customerId))];

  const winners: {
    spinEventId: string;
    customerId: string;
    prizeLabel: string;
    prizeAmount: string;
    rank: number;
    isPreselected: boolean;
    announcedAt: Date;
    recordedByStaffId: string;
  }[] = [];

  const prizes = [
    { label: 'First prize', amount: '2500.00' },
    { label: 'Second prize', amount: '1500.00' },
    { label: 'Third prize', amount: '1000.00' },
  ];

  for (const [index, event] of insertedEvents.entries()) {
    if (event.status !== SpinEventStatus.COMPLETED) continue;

    const count = index === 0 ? 3 : 2;
    for (let rank = 0; rank < count; rank += 1) {
      const customerId = qualifiedCustomerIds[(index * 3 + rank) % qualifiedCustomerIds.length];
      if (!customerId) continue;

      winners.push({
        spinEventId: event.id,
        customerId,
        prizeLabel: prizes[rank]?.label ?? `Prize ${rank + 1}`,
        prizeAmount: prizes[rank]?.amount ?? '500.00',
        rank: rank + 1,
        isPreselected: index === 1,
        announcedAt: daysAgo(14 - index * 7),
        recordedByStaffId: masterId,
      });
    }
  }

  if (winners.length > 0) {
    await db.insert(spinWinners).values(winners);
  }

  // ── Audit trail ───────────────────────────────────────────────────────
  /*
   * Spread across actors, actions and outcomes so the trail is worth
   * reading: several staff, a customer, a scheduled job with no request
   * behind it, and refusals alongside successes. A trail of nothing but
   * 200s from one account demonstrates nothing.
   */
  const actors = [
    { id: masterId, role: 'master', type: 'staff' as const },
    ...staff.managers
      .slice(0, 2)
      .map((m) => ({ id: m.id, role: 'manager', type: 'staff' as const })),
    ...staff.runners.slice(0, 2).map((r) => ({ id: r.id, role: 'runner', type: 'staff' as const })),
  ];

  const entries: (typeof auditLogs.$inferInsert)[] = [];

  const actions = [
    {
      action: 'customer.created',
      entity: 'customer',
      method: 'POST',
      path: '/api/v1/team/customers',
      status: 201,
    },
    {
      action: 'customer.status_changed',
      entity: 'customer',
      method: 'PATCH',
      path: '/api/v1/team/customers/:id/status',
      status: 200,
    },
    {
      action: 'transaction.created',
      entity: 'transaction',
      method: 'POST',
      path: '/api/v1/team/transactions',
      status: 201,
    },
    {
      action: 'transaction.corrected',
      entity: 'transaction',
      method: 'POST',
      path: '/api/v1/team/transactions/:id/correction',
      status: 201,
    },
    {
      action: 'staff.created',
      entity: 'staff',
      method: 'POST',
      path: '/api/v1/team/staff',
      status: 201,
    },
    {
      action: 'staff.deactivated',
      entity: 'staff',
      method: 'PATCH',
      path: '/api/v1/team/staff/:id/deactivate',
      status: 200,
    },
    {
      action: 'vip_criteria.created',
      entity: 'vip_criteria',
      method: 'POST',
      path: '/api/v1/team/vip-criteria',
      status: 201,
    },
    {
      action: 'spin_event.created',
      entity: 'spin_event',
      method: 'POST',
      path: '/api/v1/team/spin-events',
      status: 201,
    },
    {
      action: 'export.generated',
      entity: 'export',
      method: 'GET',
      path: '/api/v1/team/exports/customers',
      status: 200,
    },
  ];

  for (let index = 0; index < 90; index += 1) {
    const actor = actors[index % actors.length];
    const template = actions[index % actions.length];
    const customer = customers[index % customers.length];

    entries.push({
      actorType: actor.type,
      actorId: actor.id,
      actorRole: actor.role,
      action: template.action,
      entityType: template.entity,
      entityId: customer?.id ?? null,
      metadata: { seeded: true, note: 'Demo activity' },
      method: template.method,
      path: template.path,
      statusCode: template.status,
      ip: `10.0.0.${(index % 60) + 2}`,
      userAgent: 'Mozilla/5.0 (seed)',
      correlationId: `seed-${String(index).padStart(4, '0')}`,
      createdAt: daysAgo(Math.floor(index / 3)),
    });
  }

  // Refusals — a runner reaching for another chain, and a manager reaching
  // for the audit trail. These are the entries an auditor actually looks for.
  const runner = staff.runners[0];
  const manager = staff.managers[0];

  if (runner) {
    entries.push({
      actorType: 'staff',
      actorId: runner.id,
      actorRole: 'runner',
      action: 'customer.access_denied',
      entityType: 'customer',
      entityId: customers[0]?.id ?? null,
      metadata: { reason: 'Outside the actor’s chain' },
      method: 'GET',
      path: '/api/v1/team/customers/:id',
      statusCode: 404,
      ip: '10.0.0.91',
      userAgent: 'Mozilla/5.0 (seed)',
      correlationId: 'seed-denied-0001',
      createdAt: daysAgo(2),
    });
  }

  if (manager) {
    entries.push({
      actorType: 'staff',
      actorId: manager.id,
      actorRole: 'manager',
      action: 'audit.access_denied',
      entityType: 'audit_log',
      entityId: null,
      metadata: { reason: 'Audit trail is master-only' },
      method: 'GET',
      path: '/api/v1/team/audit-logs',
      statusCode: 403,
      ip: '10.0.0.92',
      userAgent: 'Mozilla/5.0 (seed)',
      correlationId: 'seed-denied-0002',
      createdAt: daysAgo(1),
    });
  }

  // A customer acting in their own realm, and a scheduled job with no
  // request behind it — which is why statusCode is nullable.
  if (customers[0]) {
    entries.push({
      actorType: 'customer',
      actorId: customers[0].id,
      actorRole: null,
      action: 'customer.signed_in',
      entityType: 'customer',
      entityId: customers[0].id,
      metadata: { realm: 'customer' },
      method: 'POST',
      path: '/api/v1/auth/customer/login',
      statusCode: 200,
      ip: '10.0.0.99',
      userAgent: 'Mozilla/5.0 (seed)',
      correlationId: 'seed-customer-0001',
      createdAt: daysAgo(1),
    });
  }

  entries.push({
    actorType: 'system',
    actorId: null,
    actorRole: null,
    action: 'vip.recomputed',
    entityType: 'vip_criteria',
    entityId: goldCriteria.id,
    metadata: { qualified: qualifications.length, trigger: 'scheduled' },
    method: null,
    path: null,
    statusCode: null,
    ip: null,
    userAgent: null,
    correlationId: 'seed-system-0001',
    createdAt: daysAgo(1),
  });

  await db.insert(auditLogs).values(entries);

  return {
    criteria: insertedCriteria.length,
    qualifications: qualifications.length,
    events: insertedEvents.length,
    winners: winners.length,
    audit: entries.length,
  };
}
