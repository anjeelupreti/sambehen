import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Post,
  Body,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { IsEmail, IsInt, Min, IsOptional, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import request from 'supertest';
import { GlobalExceptionFilter } from '../filters/global-exception.filter';
import { ResponseTransformInterceptor } from '../interceptors/response-transform.interceptor';
import { validationExceptionFactory } from '../validation/validation-exception.factory';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { ErrorCode } from '../constants/error-codes';
import {
  BusinessException,
  ResourceNotFoundException,
  ResourceConflictException,
} from '../exceptions/business.exception';

class NestedDto {
  @IsUUID('4')
  customerId!: string;
}

class SampleDto {
  @IsEmail()
  email!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NestedDto)
  winners?: NestedDto[];
}

@Controller('contract')
class ContractController {
  @Get('single')
  @ResponseMessage('Customer retrieved successfully')
  single(): { id: string; name: string } {
    return { id: 'c1', name: 'Ada' };
  }

  @Get('list')
  list(): { data: { id: string }[]; meta: object; summary: object } {
    return {
      data: [{ id: 'c1' }, { id: 'c2' }],
      meta: {
        total: 2,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      summary: { totalSpent: '480.00' },
    };
  }

  @Get('empty')
  empty(): null {
    return null;
  }

  @Get('not-found')
  notFound(): never {
    throw new ResourceNotFoundException(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found');
  }

  @Get('conflict')
  conflict(): never {
    throw new ResourceConflictException(
      ErrorCode.CUSTOMER_EMAIL_TAKEN,
      'A customer with this email already exists',
    );
  }

  @Get('business')
  business(): never {
    throw new BusinessException(
      ErrorCode.TX_CORRECTION_EXCEEDS_PARENT,
      'Correction exceeds the parent transaction amount',
      HttpStatus.UNPROCESSABLE_ENTITY,
      { parentAmount: '100.00', attempted: '150.00' },
    );
  }

  @Get('boom')
  boom(): never {
    throw new Error('connection terminated: SELECT * FROM staff_users WHERE secret = $1');
  }

  @Get('pg-unique')
  pgUnique(): never {
    const error = new Error('duplicate key value violates unique constraint') as Error & {
      code: string;
    };
    error.code = '23505';
    throw error;
  }

  @Post('validate')
  validate(@Body() dto: SampleDto): SampleDto {
    return dto;
  }
}

/**
 * Locks down the API response contract.
 *
 * Roughly seventy endpoints will be written against this envelope, so a
 * silent change to its shape would break every client at once. These tests
 * fail loudly if that happens.
 */
describe('API response contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ContractController],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('success envelope', () => {
    it('wraps a single resource and honours @ResponseMessage', async () => {
      const res = await request(app.getHttpServer()).get('/contract/single').expect(200);

      expect(res.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: 'Customer retrieved successfully',
        data: { id: 'c1', name: 'Ada' },
        path: '/contract/single',
      });
      expect(typeof res.body.timestamp).toBe('string');
      expect(res.body).toHaveProperty('correlationId');
      // `error` must never accompany a success.
      expect(res.body.error).toBeUndefined();
    });

    it('lifts meta and summary out of a paginated payload', async () => {
      const res = await request(app.getHttpServer()).get('/contract/list').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({
        total: 2,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      expect(res.body.summary).toEqual({ totalSpent: '480.00' });
    });

    it('returns data: null rather than 204 for an empty result', async () => {
      const res = await request(app.getHttpServer()).get('/contract/empty').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });
  });

  describe('error envelope', () => {
    it('reports a domain 404 with its specific error code', async () => {
      const res = await request(app.getHttpServer()).get('/contract/not-found').expect(404);

      expect(res.body).toMatchObject({
        success: false,
        statusCode: 404,
        message: 'Customer not found',
        error: { code: ErrorCode.CUSTOMER_NOT_FOUND, details: null },
      });
      // `data` must never accompany a failure.
      expect(res.body.data).toBeUndefined();
    });

    it('reports a 409 conflict', async () => {
      const res = await request(app.getHttpServer()).get('/contract/conflict').expect(409);

      expect(res.body.error.code).toBe(ErrorCode.CUSTOMER_EMAIL_TAKEN);
    });

    it('passes structured details through on a business rule failure', async () => {
      const res = await request(app.getHttpServer()).get('/contract/business').expect(422);

      expect(res.body.error).toEqual({
        code: ErrorCode.TX_CORRECTION_EXCEEDS_PARENT,
        details: { parentAmount: '100.00', attempted: '150.00' },
      });
    });

    it('maps a postgres unique violation onto 409', async () => {
      const res = await request(app.getHttpServer()).get('/contract/pg-unique').expect(409);

      expect(res.body.error.code).toBe(ErrorCode.CONFLICT);
    });

    it('never leaks internals on an unexpected failure', async () => {
      const res = await request(app.getHttpServer()).get('/contract/boom').expect(500);

      expect(res.body).toMatchObject({
        success: false,
        statusCode: 500,
        message: 'An unexpected error occurred',
        error: { code: ErrorCode.INTERNAL_ERROR, details: null },
      });

      const serialised = JSON.stringify(res.body);
      expect(serialised).not.toContain('SELECT');
      expect(serialised).not.toContain('staff_users');
      expect(serialised).not.toContain('connection terminated');
    });
  });

  describe('validation errors', () => {
    it('returns 422 with one detail entry per failed constraint', async () => {
      const res = await request(app.getHttpServer())
        .post('/contract/validate')
        .send({ email: 'not-an-email', amount: 0 })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);

      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toContain('email');
      expect(fields).toContain('amount');

      for (const detail of res.body.error.details) {
        expect(detail).toEqual({
          field: expect.any(String),
          constraint: expect.any(String),
          message: expect.any(String),
        });
      }
    });

    it('addresses nested array failures with a dotted path', async () => {
      const res = await request(app.getHttpServer())
        .post('/contract/validate')
        .send({ email: 'a@b.com', amount: 5, winners: [{ customerId: 'not-a-uuid' }] })
        .expect(422);

      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toContain('winners.0.customerId');
    });

    it('rejects unknown properties instead of silently dropping them', async () => {
      const res = await request(app.getHttpServer())
        .post('/contract/validate')
        .send({ email: 'a@b.com', amount: 5, sneakyFilter: 'all' })
        .expect(422);

      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toContain('sneakyFilter');
    });
  });
});
