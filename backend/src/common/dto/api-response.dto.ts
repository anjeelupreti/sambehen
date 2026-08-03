import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from '../constants/error-codes';

/**
 * One failed validation constraint.
 *
 * `field` uses dotted paths for nested objects and array indices, e.g.
 * `winners.0.customerId`, so a client can map an error straight onto a
 * form control.
 */
export class ValidationErrorDetailDto {
  @ApiProperty({ example: 'email', description: 'Dotted path to the offending property' })
  field!: string;

  @ApiProperty({ example: 'isEmail', description: 'class-validator constraint that failed' })
  constraint!: string;

  @ApiProperty({ example: 'email must be an email' })
  message!: string;
}

/** Error body. Present only on failure responses. */
export class ApiErrorDto {
  @ApiProperty({
    enum: ErrorCode,
    example: ErrorCode.VALIDATION_FAILED,
    description:
      'Stable machine-readable code. Part of the API contract - safe to switch on, never reworded.',
  })
  code!: ErrorCode;

  @ApiPropertyOptional({
    description:
      'Validation failures, or a structured payload for bulk operations. Null when there is nothing further to report.',
    type: [ValidationErrorDetailDto],
    nullable: true,
  })
  details?: ValidationErrorDetailDto[] | Record<string, unknown> | null;
}

/** Pagination block, present on list responses. */
export class PaginationMetaDto {
  @ApiProperty({ example: 1240, description: 'Rows matching the filter, ignoring pagination' })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  limit!: number;

  @ApiProperty({ example: 50 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

/**
 * The single response envelope used by every endpoint.
 *
 * Invariants:
 *  - `success` is exactly `statusCode < 400`.
 *  - `data` appears only on success, `error` only on failure. Never both.
 *  - `meta` and `summary` appear only on list responses.
 *  - `correlationId` is echoed on every response and written to audit_logs,
 *    so a user-reported failure can be traced to its server-side log line.
 *
 * Binary responses (Excel/CSV exports) opt out via `@RawResponse()`.
 */
export class ApiResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 200, description: 'Mirrors the HTTP status code' })
  statusCode!: number;

  @ApiProperty({ example: 'Customers retrieved successfully' })
  message!: string;

  @ApiPropertyOptional({ description: 'Payload. Present on success only.', nullable: true })
  data?: T | null;

  @ApiPropertyOptional({ type: ApiErrorDto, description: 'Present on failure only.' })
  error?: ApiErrorDto;

  @ApiPropertyOptional({ type: PaginationMetaDto, description: 'Present on list responses.' })
  meta?: PaginationMetaDto;

  @ApiPropertyOptional({
    description:
      'Aggregates computed over the whole filtered set, not just the current page. List responses only.',
  })
  summary?: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-31T10:12:33.284Z', format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/team/customers' })
  path!: string;

  @ApiProperty({ example: '3f2a9c14-6f1b-4f0e-9a3d-1c2b8e7d5a40' })
  correlationId!: string;
}
