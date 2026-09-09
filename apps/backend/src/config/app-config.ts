import { envSchema, type ValidatedEnvConfig } from './env.schema.js';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'staging' | 'production';
  port: number;
  host: string;
  apiPrefix: string;
  corsOrigins: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  apiDocsEnabled: boolean;
  bodyLimit: string;
  rateLimitTtl: number;
  rateLimitLimit: number;
  databaseUrl: string;
  databasePoolMin: number;
  databasePoolMax: number;
  databaseSsl: boolean;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
}

export function loadAppConfig(rawEnv: Record<string, unknown> = process.env): AppConfig {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const formattedErrors = result.error.format();
    const errorMessages = Object.entries(formattedErrors)
      .filter(([key]) => key !== '_errors')
      .map(([key, value]) => `${key}: ${(value as { _errors: string[] })._errors.join(', ')}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${errorMessages}`);
  }

  const data: ValidatedEnvConfig = result.data;
  const isProd = data.NODE_ENV === 'production';
  const isDev = data.NODE_ENV === 'development';
  const isTest = data.NODE_ENV === 'test';

  // Docs are enabled explicitly or default to enabled in dev/test, disabled in prod
  const apiDocsEnabled = data.API_DOCS_ENABLED ?? (isDev || isTest);

  // In production, reject wildcard CORS
  if (isProd && data.CORS_ORIGINS.includes('*')) {
    throw new Error('Insecure configuration: Wildcard CORS origin ("*") is strictly forbidden in production.');
  }

  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    host: data.HOST,
    apiPrefix: data.API_PREFIX.replace(/^\/+|\/+$/g, ''),
    corsOrigins: data.CORS_ORIGINS,
    logLevel: data.LOG_LEVEL,
    apiDocsEnabled,
    bodyLimit: data.BODY_LIMIT,
    rateLimitTtl: data.RATE_LIMIT_TTL,
    rateLimitLimit: data.RATE_LIMIT_LIMIT,
    databaseUrl: data.DATABASE_URL,
    databasePoolMin: data.DATABASE_POOL_MIN,
    databasePoolMax: data.DATABASE_POOL_MAX,
    databaseSsl: Boolean(data.DATABASE_SSL),
    isProduction: isProd,
    isDevelopment: isDev,
    isTest: isTest,
  };
}
