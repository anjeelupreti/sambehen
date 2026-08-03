import { ValidationError } from 'class-validator';
import { ValidationException } from '../exceptions/business.exception';
import { ValidationErrorDetailDto } from '../dto/api-response.dto';

/**
 * Flattens class-validator's nested error tree into a flat list of
 * `{ field, constraint, message }`.
 *
 * Nested objects and array elements are addressed with dotted paths, so a
 * failure inside `winners[0].customerId` is reported as
 * `winners.0.customerId` and a client can map it onto a form control
 * without parsing anything.
 */
function flatten(errors: ValidationError[], parentPath = ''): ValidationErrorDetailDto[] {
  const details: ValidationErrorDetailDto[] = [];

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      for (const [constraint, message] of Object.entries(error.constraints)) {
        details.push({ field: path, constraint, message });
      }
    }

    if (error.children && error.children.length > 0) {
      details.push(...flatten(error.children, path));
    }
  }

  return details;
}

/**
 * ValidationPipe `exceptionFactory`.
 *
 * Replaces Nest's default BadRequestException, whose `message` is a bare
 * `string[]`. That array was previously coerced to a string by the global
 * filter, losing which field failed and why. This produces a structured
 * 422 instead.
 */
export function validationExceptionFactory(errors: ValidationError[]): ValidationException {
  const details = flatten(errors);

  return new ValidationException(
    details,
    details.length === 1
      ? 'Validation failed for 1 field'
      : `Validation failed for ${details.length} fields`,
  );
}
