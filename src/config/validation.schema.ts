import * as Joi from 'joi';

/**
 * Environment contract, enforced at boot.
 *
 * A missing or malformed variable fails startup immediately rather than
 * surfacing as a null-pointer on the first request that needs it.
 * Anything security-relevant is `.required()` with no default.
 */
export const validationSchema = Joi.object({
  // ── Application ────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  APP_NAME: Joi.string().default('sambehen'),
  APP_PORT: Joi.number().port().default(3000),
  APP_HOST: Joi.string().default('0.0.0.0'),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('1'),
  APP_CORS_ORIGIN: Joi.string().default('*'),
  APP_PUBLIC_URL: Joi.string().uri().default('http://localhost:3000'),

  // ── Database ───────────────────────────────────────────────
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MIN: Joi.number().min(0).default(2),
  DB_POOL_MAX: Joi.number().min(1).default(10),

  // ── Redis ──────────────────────────────────────────────────
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),
  REDIS_TTL: Joi.number().default(300),

  // ── JWT ────────────────────────────────────────────────────
  // Four distinct secrets: access/refresh across team/customer. Sharing a
  // secret between realms would defeat the realm separation, so each is
  // required independently and must be long enough to resist brute force.
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_CUSTOMER_SECRET: Joi.string().min(32).required(),
  JWT_CUSTOMER_EXPIRES_IN: Joi.string().default('30m'),
  JWT_CUSTOMER_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_CUSTOMER_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // ── Rate limiting ──────────────────────────────────────────
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),

  // ── Mail ───────────────────────────────────────────────────
  SMTP_HOST: Joi.string().default('localhost'),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASSWORD: Joi.string().allow('').default(''),
  // tlds: false — Joi validates against the IANA TLD list by default,
  // which rejects internal senders like no-reply@sambehen.local and any
  // corporate .internal domain.
  MAIL_FROM: Joi.string()
    .email({ tlds: { allow: false } })
    .default('no-reply@sambehen.local'),
  MAIL_FROM_NAME: Joi.string().default('Sambehen'),
  EMAIL_BATCH_SIZE: Joi.number().min(1).max(1000).default(50),

  // ── Business rules ─────────────────────────────────────────
  ACTIVE_CUSTOMER_WINDOW_DAYS: Joi.number().min(1).default(30),
  HIGH_SPENDER_THRESHOLD: Joi.string().default('250.00'),
  REFERRAL_LINK_BASE_URL: Joi.string().uri().default('http://localhost:3000/r'),

  // ── Exports ────────────────────────────────────────────────
  EXPORT_SYNC_ROW_LIMIT: Joi.number().min(1).default(50000),
  EXPORT_RETENTION_HOURS: Joi.number().min(1).default(48),
  EXPORT_STORAGE_PATH: Joi.string().default('./storage/exports'),
  EXPORT_TIMEZONE: Joi.string().default('UTC'),

  // ── Logging ────────────────────────────────────────────────
  LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),

  // ── Swagger ────────────────────────────────────────────────
  // Off by default in production: the docs expose the full surface area,
  // including every error code and filter parameter.
  SWAGGER_ENABLED: Joi.boolean().default(process.env.NODE_ENV !== 'production'),
  SWAGGER_TITLE: Joi.string().default('Sambehen API'),
  SWAGGER_DESCRIPTION: Joi.string().default('Data Entry Management System API'),
  SWAGGER_VERSION: Joi.string().default('1.0'),
});
