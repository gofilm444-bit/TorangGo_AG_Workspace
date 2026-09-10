import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  PORT: z
    .coerce.number()
    .int()
    .min(1)
    .max(65535)
    .default(4000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('api/v1'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean)),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error', 'silent'])
    .default('info'),
  API_DOCS_ENABLED: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true' || val === '1';
    }),
  BODY_LIMIT: z.string().default('1mb'),
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(100),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5433/toranggo_dev'),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DATABASE_SSL: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth & Session Configuration
  AUTH_ISSUER: z.string().default('toranggo-auth'),
  AUTH_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  AUTH_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604800),
  AUTH_JWT_SECRET: z.string().default('toranggo-dev-insecure-auth-jwt-secret-key-32chars-min!'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_PROVIDER: z.enum(['development', 'mock', 'production']).default('development'),
  OTP_HMAC_SECRET: z.string().default('toranggo-dev-otp-hmac-secret-key-32chars-min!'),
  ADMIN_MFA_ENCRYPTION_KEY: z
    .string()
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  COOKIE_SECRET: z.string().default('toranggo-dev-cookie-secret-key-32chars-min!'),
});

export type RawEnvConfig = z.input<typeof envSchema>;
export type ValidatedEnvConfig = z.output<typeof envSchema>;
