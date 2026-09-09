import type { AppAudience } from '@platform/shared-types';

/**
 * Client-safe configuration contracts for mobile and web applications.
 * NEVER expose backend database URLs, Redis credentials, or secrets here.
 */

export type AppEnvironment = 'development' | 'staging' | 'production' | 'test';

export interface ClientAppConfig {
  apiBaseUrl: string;
  appEnv: AppEnvironment;
  audience?: AppAudience;
}

/**
 * Resolves client-safe configuration from overrides or environment variables.
 * Fallbacks safely to local development without hardcoding production secrets.
 */
export function resolveClientConfig(overrides?: Partial<ClientAppConfig>): ClientAppConfig {
  const envObj = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })?.process?.env;

  const env = (
    overrides?.appEnv ??
    envObj?.EXPO_PUBLIC_APP_ENV ??
    envObj?.NEXT_PUBLIC_APP_ENV ??
    envObj?.NODE_ENV ??
    'development'
  ) as AppEnvironment;

  const defaultBaseUrl = env === 'production' ? 'https://api.toranggo.com' : 'http://localhost:3000';

  const baseUrl = (
    overrides?.apiBaseUrl ??
    envObj?.EXPO_PUBLIC_API_URL ??
    envObj?.NEXT_PUBLIC_API_URL ??
    envObj?.API_BASE_URL ??
    defaultBaseUrl
  ).replace(/\/+$/, '');

  const audience = (
    overrides?.audience ??
    (envObj?.EXPO_PUBLIC_APP_AUDIENCE as AppAudience | undefined) ??
    (envObj?.NEXT_PUBLIC_APP_AUDIENCE as AppAudience | undefined)
  );

  return {
    apiBaseUrl: baseUrl,
    appEnv: env,
    ...(audience ? { audience } : {}),
  };
}
