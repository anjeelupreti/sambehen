import { applyDecorators, Type, HttpStatus } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  ApiQuery,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ApiResponseDto,
  ApiErrorDto,
  PaginationMetaDto,
  ValidationErrorDetailDto,
} from '../dto/api-response.dto';
import { ErrorCode } from '../constants/error-codes';
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from '../dto/pagination.dto';
import { SortOrder } from '../constants/app.constants';

/**
 * `ApiResponseDto<T>` is a runtime-erased generic, so Swagger renders its
 * `data` property as an empty object. These decorators re-attach the
 * concrete model with `getSchemaPath`, producing accurate schemas that a
 * client generator can consume.
 *
 * Use these rather than hand-written `@ApiResponse` blocks so the
 * documented envelope always matches what the interceptor emits.
 */

/** 200 with a single object in `data`. */
export const ApiOkData = <TModel extends Type<unknown>>(
  model: TModel,
  description = 'Request completed successfully',
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          { properties: { data: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  );

/** 201 with the created object in `data`. */
export const ApiCreatedData = <TModel extends Type<unknown>>(
  model: TModel,
  description = 'Resource created successfully',
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiCreatedResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          { properties: { data: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  );

/**
 * 200 with a paginated list: `data[]` plus `meta`, and `summary` when the
 * list publishes aggregate metrics.
 */
export const ApiOkList = <TModel extends Type<unknown>>(
  model: TModel,
  summaryModel?: Type<unknown>,
  description = 'Request completed successfully',
): MethodDecorator => {
  const extraModels = summaryModel
    ? [ApiResponseDto, PaginationMetaDto, model, summaryModel]
    : [ApiResponseDto, PaginationMetaDto, model];

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: { $ref: getSchemaPath(PaginationMetaDto) },
              ...(summaryModel ? { summary: { $ref: getSchemaPath(summaryModel) } } : {}),
            },
          },
        ],
      },
    }),
  );
};

/** 200 with no payload — `data` is null. */
export const ApiOkMessage = (description = 'Request completed successfully'): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          { properties: { data: { type: 'object', nullable: true, example: null } } },
        ],
      },
    }),
  );

interface IErrorExample {
  description: string;
  code: ErrorCode;
  message: string;
  details?: unknown;
}

const ERROR_EXAMPLES: Readonly<Record<number, IErrorExample>> = Object.freeze({
  [HttpStatus.BAD_REQUEST]: {
    description: 'Malformed request — unparseable body, query or path parameter',
    code: ErrorCode.BAD_REQUEST,
    message: 'A value was not in the expected format',
  },
  [HttpStatus.UNAUTHORIZED]: {
    description: 'Missing, expired or invalid access token',
    code: ErrorCode.AUTH_TOKEN_EXPIRED,
    message: 'Access token has expired',
  },
  [HttpStatus.FORBIDDEN]: {
    description: 'Authenticated, but the role lacks this capability',
    code: ErrorCode.AUTH_FORBIDDEN_ROLE,
    message: 'This action requires one of the following roles: master',
  },
  [HttpStatus.NOT_FOUND]: {
    description:
      "Resource does not exist, or lies outside the actor's scope. Cross-scope access returns 404 rather than 403 so the API never confirms that another chain's record exists.",
    code: ErrorCode.NOT_FOUND,
    message: 'Resource not found',
  },
  [HttpStatus.CONFLICT]: {
    description: 'Uniqueness or state conflict',
    code: ErrorCode.CONFLICT,
    message: 'A record with these details already exists',
  },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    description: 'Validation failed, or a business rule rejected semantically valid input',
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Validation failed for 2 fields',
    details: [
      { field: 'email', constraint: 'isEmail', message: 'email must be an email' },
      {
        field: 'amount',
        constraint: 'min',
        message: 'amount must not be less than 0.01',
      },
    ],
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    description: 'Rate limit exceeded',
    code: ErrorCode.RATE_LIMITED,
    message: 'Too many requests',
  },
  [HttpStatus.INTERNAL_SERVER_ERROR]: {
    description:
      'Unexpected failure. The message is deliberately generic; use correlationId to locate the server-side log entry.',
    code: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred',
  },
});

/**
 * Documents the error envelope for the given statuses.
 *
 *   @ApiErrors(401, 403, 404, 422)
 */
export const ApiErrors = (...statuses: number[]): MethodDecorator => {
  const decorators = statuses
    .filter((status) => ERROR_EXAMPLES[status])
    .map((status) => {
      const example = ERROR_EXAMPLES[status];
      return ApiResponse({
        status,
        description: example.description,
        schema: {
          allOf: [{ $ref: getSchemaPath(ApiResponseDto) }],
          example: {
            success: false,
            statusCode: status,
            message: example.message,
            error: { code: example.code, details: example.details ?? null },
            timestamp: '2026-07-31T10:12:33.284Z',
            path: '/api/v1/team/customers',
            correlationId: '3f2a9c14-6f1b-4f0e-9a3d-1c2b8e7d5a40',
          },
        },
      });
    });

  return applyDecorators(
    ApiExtraModels(ApiResponseDto, ApiErrorDto, ValidationErrorDetailDto),
    ...decorators,
  );
};

/** Documents the pagination, search and sorting query parameters. */
export const ApiPaginatedQuery = (sortableColumns: string[] = []): MethodDecorator =>
  applyDecorators(
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: DEFAULT_PAGE_SIZE,
      description: `Rows per page, capped at ${MAX_PAGE_SIZE}`,
    }),
    ApiQuery({
      name: 'search',
      required: false,
      type: String,
      description: "Case-insensitive free-text search across the resource's searchable columns",
    }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      ...(sortableColumns.length > 0
        ? { enum: sortableColumns, description: `One of: ${sortableColumns.join(', ')}` }
        : {}),
    }),
    ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder }),
  );
