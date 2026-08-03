import { registerAs } from '@nestjs/config';

/**
 * JWT settings.
 *
 * The team and customer realms use different signing secrets. That is what
 * makes cross-realm replay structurally impossible: a customer token
 * presented to a team route fails signature verification, rather than
 * relying on a claim check that a forged payload could satisfy.
 *
 * No fallback defaults here - the Joi schema requires every secret, so a
 * missing one fails the boot instead of silently signing tokens with a
 * well-known string.
 */
export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET as string,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  customerSecret: process.env.JWT_CUSTOMER_SECRET as string,
  customerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN || '30m',
  customerRefreshSecret: process.env.JWT_CUSTOMER_REFRESH_SECRET as string,
  customerRefreshExpiresIn: process.env.JWT_CUSTOMER_REFRESH_EXPIRES_IN || '30d',
}));
