import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { GlobalExceptionFilter } from '../filters/global-exception.filter';
import { ResponseTransformInterceptor } from '../interceptors/response-transform.interceptor';
import { TeamJwtGuard } from '../guards/team-jwt.guard';
import { RolesGuard } from '../guards/roles.guard';
import { TeamAuth, CustomerAuth } from '../decorators/composite-auth.decorator';
import { Public, CurrentStaff, CurrentCustomer } from '../decorators/auth.decorators';
import { AuthRealm, StaffRole } from '../constants/app.constants';
import { ErrorCode } from '../constants/error-codes';
import { ICurrentStaff, ICurrentCustomer } from '../interfaces/auth.interface';
import { JwtTeamStrategy } from '@shared/auth/strategies/jwt-team.strategy';
import { JwtCustomerStrategy } from '@shared/auth/strategies/jwt-customer.strategy';

const TEAM_SECRET = 'team-secret-at-least-32-characters-long!!';
const CUSTOMER_SECRET = 'customer-secret-at-least-32-characters!!!';

const STAFF_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';

@Controller('probe')
class ProbeController {
  @Get('open')
  @Public()
  open(): { ok: boolean } {
    return { ok: true };
  }

  @Get('team')
  @TeamAuth()
  team(@CurrentStaff() staff: ICurrentStaff): ICurrentStaff {
    return staff;
  }

  @Get('master-only')
  @TeamAuth(StaffRole.MASTER)
  masterOnly(): { ok: boolean } {
    return { ok: true };
  }

  @Get('customer')
  @CustomerAuth()
  customer(@CurrentCustomer() customer: ICurrentCustomer): ICurrentCustomer {
    return customer;
  }
}

/**
 * Guards the two-realm routing contract.
 *
 * A regression here shipped once already: TeamJwtGuard is registered
 * globally and global guards run before route-level ones, so it verified
 * customer tokens against the TEAM secret and rejected every one as an
 * invalid signature. Every customer route was unreachable.
 *
 * The original tests only asserted that the WRONG token is refused, which
 * stayed true while the right token was refused too. These assert both
 * directions for both realms.
 */
describe('Realm routing', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const teamToken = (overrides: Record<string, unknown> = {}): string =>
    jwt.sign(
      {
        sub: STAFF_ID,
        realm: AuthRealm.TEAM,
        email: 'master@test.local',
        username: 'master',
        role: StaffRole.MASTER,
        parentId: null,
        ...overrides,
      },
      { secret: TEAM_SECRET, expiresIn: '5m' },
    );

  const customerToken = (overrides: Record<string, unknown> = {}): string =>
    jwt.sign(
      {
        sub: CUSTOMER_ID,
        realm: AuthRealm.CUSTOMER,
        email: 'customer@test.local',
        username: 'customer',
        ...overrides,
      },
      { secret: CUSTOMER_SECRET, expiresIn: '5m' },
    );

  beforeAll(async () => {
    const config = {
      getOrThrow: (key: string): string => {
        if (key === 'jwt.secret') return TEAM_SECRET;
        if (key === 'jwt.customerSecret') return CUSTOMER_SECRET;
        throw new Error(`unexpected config key ${key}`);
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({})],
      controllers: [ProbeController],
      providers: [
        { provide: ConfigService, useValue: config },
        JwtTeamStrategy,
        JwtCustomerStrategy,
        { provide: APP_GUARD, useClass: TeamJwtGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('team routes', () => {
    it('accepts a team token', async () => {
      const res = await request(app.getHttpServer())
        .get('/probe/team')
        .set('Authorization', `Bearer ${teamToken()}`)
        .expect(200);

      expect(res.body.data).toMatchObject({ id: STAFF_ID, realm: AuthRealm.TEAM });
    });

    it('rejects a customer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/probe/team')
        .set('Authorization', `Bearer ${customerToken()}`)
        .expect(401);

      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(app.getHttpServer()).get('/probe/team').expect(401);

      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
    });
  });

  describe('customer routes', () => {
    it('accepts a customer token', async () => {
      // The case the original suite never asserted, and the one that broke.
      const res = await request(app.getHttpServer())
        .get('/probe/customer')
        .set('Authorization', `Bearer ${customerToken()}`)
        .expect(200);

      expect(res.body.data).toMatchObject({ id: CUSTOMER_ID, realm: AuthRealm.CUSTOMER });
    });

    it('rejects a team token', async () => {
      const res = await request(app.getHttpServer())
        .get('/probe/customer')
        .set('Authorization', `Bearer ${teamToken()}`)
        .expect(401);

      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    });

    it('rejects an unauthenticated request — standing aside is a handover, not a bypass', async () => {
      const res = await request(app.getHttpServer()).get('/probe/customer').expect(401);

      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
    });

    it('rejects a customer token forged with the team secret', async () => {
      const forged = jwt.sign(
        { sub: CUSTOMER_ID, realm: AuthRealm.CUSTOMER, email: 'x@y.local', username: 'x' },
        { secret: TEAM_SECRET, expiresIn: '5m' },
      );

      await request(app.getHttpServer())
        .get('/probe/customer')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });
  });

  describe('role capability', () => {
    it('allows a master through a master-only route', async () => {
      await request(app.getHttpServer())
        .get('/probe/master-only')
        .set('Authorization', `Bearer ${teamToken()}`)
        .expect(200);
    });

    it('refuses a store with 403, not 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/probe/master-only')
        .set('Authorization', `Bearer ${teamToken({ role: StaffRole.STORE })}`)
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCode.AUTH_FORBIDDEN_ROLE);
    });
  });

  describe('public routes', () => {
    it('needs no token', async () => {
      await request(app.getHttpServer()).get('/probe/open').expect(200);
    });
  });
});
