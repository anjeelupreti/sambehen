import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';
import { ValidationErrorDetailDto } from '../dto/api-response.dto';

export type ErrorDetails = ValidationErrorDetailDto[] | Record<string, unknown> | null;

/** Payload every application exception carries; read by the global filter. */
export interface IBusinessExceptionPayload {
  code: ErrorCode;
  message: string;
  details: ErrorDetails;
}

/**
 * Base class for every deliberate, domain-level failure.
 *
 * Carries a stable {@link ErrorCode} alongside the HTTP status so the
 * global filter can emit one consistent error envelope. Throwing a bare
 * `HttpException` still works but yields a generic code, so prefer this or
 * one of the subclasses below.
 */
export class BusinessException extends HttpException {
  readonly code: ErrorCode;
  readonly details: ErrorDetails;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    details: ErrorDetails = null,
  ) {
    const payload: IBusinessExceptionPayload = { code, message, details };
    super(payload, status);
    this.code = code;
    this.details = details;
  }
}

/** 422 - request was well-formed but failed validation. */
export class ValidationException extends BusinessException {
  constructor(details: ValidationErrorDetailDto[], message = 'Validation failed') {
    super(ErrorCode.VALIDATION_FAILED, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

/**
 * 404 - the resource does not exist, or it exists outside the actor's scope.
 *
 * Cross-scope access deliberately resolves to "not found" rather than
 * "forbidden": a 403 would confirm that a record belonging to another
 * manager's chain exists, which is precisely what the scoping rules hide.
 */
export class ResourceNotFoundException extends BusinessException {
  constructor(code: ErrorCode = ErrorCode.NOT_FOUND, message = 'Resource not found') {
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

/** 409 - uniqueness or state conflict. */
export class ResourceConflictException extends BusinessException {
  constructor(code: ErrorCode, message: string, details: ErrorDetails = null) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

/** 401 - missing, malformed or rejected credentials. */
export class AuthenticationException extends BusinessException {
  constructor(code: ErrorCode = ErrorCode.AUTH_TOKEN_INVALID, message = 'Authentication required') {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * 403 - authenticated and in the correct realm, but the role lacks this
 * capability. Reserved for capability denials; row-level scope denials use
 * {@link ResourceNotFoundException}.
 */
export class CapabilityDeniedException extends BusinessException {
  constructor(
    code: ErrorCode = ErrorCode.AUTH_FORBIDDEN_ROLE,
    message = 'You do not have permission to perform this action',
  ) {
    super(code, message, HttpStatus.FORBIDDEN);
  }
}
