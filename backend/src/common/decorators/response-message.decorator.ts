import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'response_message';

/**
 * Overrides the envelope's `message` for a route.
 *
 *   @ResponseMessage('Customers retrieved successfully')
 *   @Get()
 *   findAll() { ... }
 *
 * Without it the interceptor falls back to a generic message derived from
 * the HTTP method.
 */
export const ResponseMessage = (message: string): CustomDecorator<string> =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
