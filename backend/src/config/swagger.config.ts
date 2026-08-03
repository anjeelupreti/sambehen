import { registerAs } from '@nestjs/config';

/**
 * Swagger settings.
 *
 * The bootstrap already read `swagger.*` from ConfigService, but no
 * namespace was ever registered under that key, so every lookup silently
 * fell through to its inline default and SWAGGER_ENABLED had no effect.
 * Registering the namespace makes the env variables actually take.
 */
export default registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED === 'true',
  title: process.env.SWAGGER_TITLE || 'Sambehen API',
  description: process.env.SWAGGER_DESCRIPTION || 'Data Entry Management System API',
  version: process.env.SWAGGER_VERSION || '1.0',
}));
