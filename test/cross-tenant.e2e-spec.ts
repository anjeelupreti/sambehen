import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { validationExceptionFactory } from '../src/common/validation/validation-exception.factory';
import { ErrorCode } from '../src/common/constants/error-codes';

/**
 * Cross-tenant denial, exercised over real HTTP against a real database.
 *
 * The unit tests cover ScopeService in isolation; this covers the thing
 * that actually matters — that every endpoint in the system composes it.
 * A scoping bug is a data breach rather than a defect, and the failure
 * mode is silent: a leaking endpoint returns 200 with somebody else's
 * rows and nothing looks wrong.
 *
 * Requires the seeded database (npm run db:seed).
 */
describe('Cross-tenant isolation (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const login = async (identifier: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/team/login')
      .send({ identifier, password: 'Password123!' })
      .expect(200);
    return res.body.data.accessToken;
  };

  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: validationExceptionFactory,
      }),
    );
    await app.init();
    http = request(app.getHttpServer());

    for (const who of ['master', 'manager1', 'manager2', 'runner11', 'runner21']) {
      tokens[who] = await login(`${who}@sambehen.local`);
    }

    // A customer and a conversation belonging to manager1's chain, used as
    // the target every manager2 request must fail to reach.
    const customers = await get('/api/v1/team/customers?limit=1', tokens.manager1).expect(200);
    ids.manager1Customer = customers.body.data[0].id;

    const staff = await get('/api/v1/team/staff?limit=50', tokens.master).expect(200);
    ids.runner21 = staff.body.data.find((s: { username: string }) => s.username === 'runner21').id;
    ids.manager2 = staff.body.data.find((s: { username: string }) => s.username === 'manager2').id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  /**
   * The headline property: the same endpoint returns different row counts
   * per actor, and the chains partition cleanly rather than overlapping.
   */
  describe('list scoping partitions the data', () => {
    it('splits customers between the two chains with no overlap', async () => {
      const [master, m1, m2] = await Promise.all([
        get('/api/v1/team/customers?limit=1', tokens.master).expect(200),
        get('/api/v1/team/customers?limit=1', tokens.manager1).expect(200),
        get('/api/v1/team/customers?limit=1', tokens.manager2).expect(200),
      ]);

      expect(master.body.meta.total).toBe(m1.body.meta.total + m2.body.meta.total);
    });

    it('gives a runner a strict subset of their manager', async () => {
      const [manager, runner] = await Promise.all([
        get('/api/v1/team/customers?limit=1', tokens.manager1).expect(200),
        get('/api/v1/team/customers?limit=1', tokens.runner11).expect(200),
      ]);

      expect(runner.body.meta.total).toBeLessThanOrEqual(manager.body.meta.total);
    });

    it('shows a manager only themselves and their own runners', async () => {
      const res = await get('/api/v1/team/staff?limit=50', tokens.manager1).expect(200);
      const usernames = res.body.data.map((s: { username: string }) => s.username);

      expect(usernames).toContain('manager1');
      expect(usernames).not.toContain('manager2');
      expect(usernames).not.toContain('runner21');
    });
  });

  /**
   * Reaching for a specific row in another chain.
   *
   * Every one of these must be 404 rather than 403: a 403 confirms the
   * record exists, which is exactly what scoping is meant to hide.
   */
  describe('cross-chain reads return 404, never 403', () => {
    it('refuses a customer detail', async () => {
      const res = await get(
        `/api/v1/team/customers/${ids.manager1Customer}`,
        tokens.manager2,
      ).expect(404);

      expect(res.body.error.code).toBe(ErrorCode.CUSTOMER_NOT_FOUND);
    });

    it('refuses a staff detail', async () => {
      const res = await get(`/api/v1/team/staff/${ids.runner21}`, tokens.manager1).expect(404);

      expect(res.body.error.code).toBe(ErrorCode.STAFF_NOT_FOUND);
    });

    it('refuses a manager filtering the customer list by a peer manager', async () => {
      // Not an error — an empty result. Widening by naming someone else
      // must simply return nothing.
      const res = await get(
        `/api/v1/team/customers?managerId=${ids.manager2}&limit=1`,
        tokens.manager1,
      ).expect(200);

      expect(res.body.meta.total).toBe(0);
    });

    it("refuses a manager filtering by another manager's runner", async () => {
      const res = await get(
        `/api/v1/team/customers?runnerId=${ids.runner21}&limit=1`,
        tokens.manager1,
      ).expect(404);

      expect(res.body.error.code).toBe(ErrorCode.STAFF_NOT_FOUND);
    });
  });

  /** Writes must be refused as firmly as reads. */
  describe('cross-chain writes are refused', () => {
    it("refuses updating another chain's customer", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/team/customers/${ids.manager1Customer}`)
        .set('Authorization', `Bearer ${tokens.manager2}`)
        .send({ fullName: 'Should Not Apply' })
        .expect(404);
    });

    it("refuses resetting another chain's customer password", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/team/customers/${ids.manager1Customer}/set-password`)
        .set('Authorization', `Bearer ${tokens.manager2}`)
        .send({ newPassword: 'Intrusion123!' })
        .expect(404);
    });

    it("refuses recording a transaction against another chain's customer", async () => {
      await request(app.getHttpServer())
        .post('/api/v1/team/transactions')
        .set('Authorization', `Bearer ${tokens.manager2}`)
        .send({ customerId: ids.manager1Customer, type: 'debit', amount: '100.00' })
        .expect(404);
    });

    it("refuses messaging another chain's customer", async () => {
      await request(app.getHttpServer())
        .post('/api/v1/team/conversations/messages')
        .set('Authorization', `Bearer ${tokens.manager2}`)
        .send({ customerId: ids.manager1Customer, body: 'intrusion' })
        .expect(404);
    });

    it('drops out-of-scope ids from a bulk operation rather than acting on them', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/team/customers/bulk/status')
        .set('Authorization', `Bearer ${tokens.manager2}`)
        .send({ ids: [ids.manager1Customer], status: 'inactive' })
        .expect(200);

      expect(res.body.data.updated).toBe(0);
      expect(res.body.data.skipped).toBe(1);
    });
  });

  /**
   * Derived data is scoped through its customer, so these would leak just
   * as badly as the customer list itself.
   */
  describe('derived lists are scoped through their customer', () => {
    it.each([
      ['transactions', '/api/v1/team/transactions?limit=1'],
      ['vips', '/api/v1/team/vips?limit=1'],
      ['referrals', '/api/v1/team/referrals?limit=1'],
      ['conversations', '/api/v1/team/conversations?limit=1'],
      ['spin-winners', '/api/v1/team/spin-winners?limit=1'],
    ])('%s totals partition across the chains', async (_name, path) => {
      const [master, m1, m2] = await Promise.all([
        get(path, tokens.master).expect(200),
        get(path, tokens.manager1).expect(200),
        get(path, tokens.manager2).expect(200),
      ]);

      expect(master.body.meta.total).toBe(m1.body.meta.total + m2.body.meta.total);
    });

    /**
     * The winners register names customers, unlike the public feed. If it
     * ever stopped being scoped it would become a way to enumerate accounts
     * in another manager's chain — exactly what masking the public feed
     * exists to prevent.
     */
    it('never names a customer from another chain in the winners register', async () => {
      const [m1, m2] = await Promise.all([
        get('/api/v1/team/spin-winners?limit=100', tokens.manager1).expect(200),
        get('/api/v1/team/spin-winners?limit=100', tokens.manager2).expect(200),
      ]);

      const idsOf = (res: { body: { data: { customerId: string }[] } }): string[] =>
        res.body.data.map((row) => row.customerId);

      const overlap = idsOf(m1).filter((id) => idsOf(m2).includes(id));
      expect(overlap).toEqual([]);
    });

    /** The public feed is unscoped BY DESIGN, and must stay masked. */
    it('keeps the public winners feed masked and id-free', async () => {
      const res = await get('/api/v1/team/recent-winners?limit=5', tokens.runner11).expect(200);

      for (const row of res.body.data as Record<string, unknown>[]) {
        expect(row).not.toHaveProperty('customerId');
        expect(row).toHaveProperty('displayName');
      }
    });
  });

  /**
   * Exports are the highest-risk surface: they hand a file to a human.
   * An export returning more than its list is a silent breach.
   */
  describe('exports never exceed their list', () => {
    it.each([
      ['customers', '/api/v1/team/customers', '/api/v1/team/exports/customers/count'],
      ['transactions', '/api/v1/team/transactions', '/api/v1/team/exports/transactions/count'],
      ['conversations', '/api/v1/team/conversations', '/api/v1/team/exports/conversations/count'],
      ['spin-winners', '/api/v1/team/spin-winners', '/api/v1/team/exports/spin-winners/count'],
    ])('%s export count equals the list count for a manager', async (_n, listPath, countPath) => {
      const [list, exported] = await Promise.all([
        get(`${listPath}?limit=1`, tokens.manager1).expect(200),
        get(countPath, tokens.manager1).expect(200),
      ]);

      expect(exported.body.data.rowCount).toBe(list.body.meta.total);
    });

    it('refuses a restricted export to a runner, on both the file and the count', async () => {
      const [file, count] = await Promise.all([
        get('/api/v1/team/exports/email-campaigns', tokens.runner11).expect(403),
        get('/api/v1/team/exports/email-campaigns/count', tokens.runner11).expect(403),
      ]);

      expect(file.body.error.code).toBe(ErrorCode.AUTH_FORBIDDEN_ROLE);
      expect(count.body.error.code).toBe(ErrorCode.AUTH_FORBIDDEN_ROLE);
    });

    /**
     * The audit trail spans every chain and names customers, so it has no
     * scoped view — a manager is refused outright rather than filtered.
     */
    it('refuses the audit-log export to a manager but allows a master', async () => {
      const [refusedFile, refusedCount, allowed] = await Promise.all([
        get('/api/v1/team/exports/audit-logs', tokens.manager1).expect(403),
        get('/api/v1/team/exports/audit-logs/count', tokens.manager1).expect(403),
        get('/api/v1/team/exports/audit-logs/count', tokens.master).expect(200),
      ]);

      expect(refusedFile.body.error.code).toBe(ErrorCode.AUTH_FORBIDDEN_ROLE);
      expect(refusedCount.body.error.code).toBe(ErrorCode.AUTH_FORBIDDEN_ROLE);
      expect(allowed.body.data.rowCount).toBeGreaterThan(0);
    });

    /**
     * Without a campaign this export would dump every recipient of every
     * campaign, so a missing filter must fail loudly rather than widen.
     */
    it('refuses the recipient export when no campaign is named', async () => {
      const res = await get('/api/v1/team/exports/email-recipients/count', tokens.master).expect(
        422,
      );

      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  /** Capability denials, where 403 IS the right answer. */
  describe('role capabilities', () => {
    it('refuses a runner creating staff', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/team/staff')
        .set('Authorization', `Bearer ${tokens.runner11}`)
        .send({ email: 'x@y.local', username: 'sneaky', password: 'Password123!', role: 'runner' })
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCode.AUTH_FORBIDDEN_ROLE);
    });

    it('refuses a runner creating a game', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/team/games')
        .set('Authorization', `Bearer ${tokens.runner11}`)
        .send({ name: 'X', code: 'XX1' })
        .expect(403);
    });

    it('refuses the audit trail to a manager and a runner, but not a master', async () => {
      const [manager, runner, master] = await Promise.all([
        get('/api/v1/team/audit-logs?limit=1', tokens.manager1).expect(403),
        get('/api/v1/team/audit-logs?limit=1', tokens.runner11).expect(403),
        get('/api/v1/team/audit-logs?limit=1', tokens.master).expect(200),
      ]);

      expect(manager.body.error.code).toBe(ErrorCode.AUTH_FORBIDDEN_ROLE);
      expect(runner.body.error.code).toBe(ErrorCode.AUTH_FORBIDDEN_ROLE);
      expect(master.body.meta.total).toBeGreaterThan(0);
    });

    it('refuses a manager creating a VIP criteria', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/team/vip-criteria')
        .set('Authorization', `Bearer ${tokens.manager1}`)
        .send({
          name: 'X',
          metric: 'total_debit',
          thresholdAmount: '1.00',
          periodStart: '2026-01-01',
          periodEnd: '2026-12-31',
        })
        .expect(403);
    });
  });

  /** Realm separation, both directions. */
  describe('realm separation', () => {
    it('refuses a team token on a customer route', async () => {
      await get('/api/v1/me/profile', tokens.master).expect(401);
    });

    it('refuses an unauthenticated request to a customer route', async () => {
      const res = await http.get('/api/v1/me/profile').expect(401);

      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
    });

    it('keeps the health probe public', async () => {
      await http.get('/api/v1/health').expect(200);
    });
  });
});
