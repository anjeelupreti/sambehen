import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { ValidationException } from '../exceptions/business.exception';

/**
 * Validates a UUID path or query parameter.
 *
 * Emits the same structured 422 as body validation rather than a bare
 * BadRequestException, so a client parses one error shape everywhere. It
 * also stops a malformed id reaching postgres, which would otherwise
 * surface as SQLSTATE 22P02 with a far less useful message.
 */
@Injectable()
export class ParseUUIDPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!isUuid(value)) {
      const field = metadata.data ?? 'id';
      throw new ValidationException(
        [{ field, constraint: 'isUuid', message: `${field} must be a valid UUID` }],
        'Validation failed for 1 field',
      );
    }
    return value;
  }
}

/** @deprecated Use {@link ParseUUIDPipe}. */
export const ParseUuidPipe = ParseUUIDPipe;
