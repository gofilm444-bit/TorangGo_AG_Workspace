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
  REDIS_URL: z.string().optional(),
});

export type RawEnvConfig = z.input<typeof envSchema>;
export type ValidatedEnvConfig = z.output<typeof envSchema>;
