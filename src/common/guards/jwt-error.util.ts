import { Request } from 'express';
import { ErrorCode } from '../constants/error-codes';
import { AuthenticationException } from '../exceptions/business.exception';

/** A well-formed bearer credential: the scheme, whitespace, then a JWT. */
const BEARER_PATTERN = /^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+\s*$/i;

/**
 * Turns a passport-jwt failure into a specific, actionable error.
 *
 * Without this every failure collapses to "Invalid access token": a
 * missing header, a token pasted with the `Bearer` prefix duplicated, a
 * quoted token, and a genuinely forged signature all look identical, so a
 * client cannot tell a configuration mistake from a real auth failure.
 *
 * Note that passport-jwt reports a missing token as a plain
 * `Error('No auth token')` whose `name` is just 'Error', so it cannot be
 * detected by name — the header itself has to be inspected.
 */
export function resolveAuthError(info: unknown, request: Request): AuthenticationException {
  const header = request.headers.authorization;

  if (!header || header.trim() === '') {
    return new AuthenticationException(
      ErrorCode.AUTH_TOKEN_MISSING,
      'Authorization header is missing. Send "Authorization: Bearer <accessToken>".',
    );
  }

  if (!BEARER_PATTERN.test(header)) {
    return new AuthenticationException(
      ErrorCode.AUTH_TOKEN_INVALID,
      'Malformed Authorization header. Expected exactly "Bearer <accessToken>" — check for a duplicated "Bearer" prefix, surrounding quotes, or a truncated token.',
    );
  }

  const name = (info as Error | undefined)?.name;

  if (name === 'TokenExpiredError') {
    return new AuthenticationException(
      ErrorCode.AUTH_TOKEN_EXPIRED,
      'Access token has expired. Use the refresh endpoint to obtain a new one.',
    );
  }

  if (name === 'JsonWebTokenError') {
    // Correct shape, bad signature: most often a token from the other
    // realm, since the two are signed with different secrets.
    return new AuthenticationException(
      ErrorCode.AUTH_TOKEN_INVALID,
      'Access token signature is invalid. Confirm the token was issued by this environment and belongs to this realm.',
    );
  }

  if (name === 'NotBeforeError') {
    return new AuthenticationException(
      ErrorCode.AUTH_TOKEN_INVALID,
      'Access token is not valid yet.',
    );
  }

  return new AuthenticationException(ErrorCode.AUTH_TOKEN_INVALID, 'Invalid access token');
}
