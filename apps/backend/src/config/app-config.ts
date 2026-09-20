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
  redisUrl: string;
  authIssuer: string;
  authAccessTokenTtl: number;
  authRefreshTokenTtl: number;
  authJwtSecret: string;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpProvider: 'development' | 'mock' | 'production';
  otpHmacSecret: string;
  adminMfaEncryptionKey: string;
  cookieSecret: string;
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

  // Production security fail-fast checks
  if (isProd) {
    if (data.OTP_PROVIDER === 'development') {
      throw new Error('Insecure configuration: Development OTP provider is strictly forbidden in production.');
    }
    if (data.AUTH_JWT_SECRET.includes('insecure') || data.AUTH_JWT_SECRET.length < 32) {
      throw new Error('Insecure configuration: Production requires a secure AUTH_JWT_SECRET of at least 32 characters.');
    }
    if (data.OTP_HMAC_SECRET.includes('dev-otp') || data.OTP_HMAC_SECRET.length < 32) {
      throw new Error('Insecure configuration: Production requires a secure OTP_HMAC_SECRET of at least 32 characters.');
    }
    if (data.ADMIN_MFA_ENCRYPTION_KEY === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' || data.ADMIN_MFA_ENCRYPTION_KEY.length !== 64) {
      throw new Error('Insecure configuration: Production requires a secure 32-byte hex ADMIN_MFA_ENCRYPTION_KEY.');
    }
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
    redisUrl: data.REDIS_URL,
    authIssuer: data.AUTH_ISSUER,
    authAccessTokenTtl: data.AUTH_ACCESS_TOKEN_TTL,
    authRefreshTokenTtl: data.AUTH_REFRESH_TOKEN_TTL,
    authJwtSecret: data.AUTH_JWT_SECRET,
    otpTtlSeconds: data.OTP_TTL_SECONDS,
    otpMaxAttempts: data.OTP_MAX_ATTEMPTS,
    otpResendCooldownSeconds: data.OTP_RESEND_COOLDOWN_SECONDS,
    otpProvider: data.OTP_PROVIDER,
    otpHmacSecret: data.OTP_HMAC_SECRET,
    adminMfaEncryptionKey: data.ADMIN_MFA_ENCRYPTION_KEY,
    cookieSecret: data.COOKIE_SECRET,
    isProduction: isProd,
    isDevelopment: isDev,
    isTest: isTest,
  };
}
