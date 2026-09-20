import { resolveClientConfig, type ClientAppConfig, type AppEnvironment } from '@platform/config';

/**
 * Client-safe configuration for TorangGo Admin Web.
 *
 * NEVER expose backend database URLs, Redis credentials, service keys,
 * or signing secrets here.
 * Base URL and environment are safely resolved from environment variables
 * or fallbacks via @platform/config.
 *
 * Statically access process.env.NEXT_PUBLIC_* variables so that the
 * Next.js compiler (Turbopack / Webpack) inlines them into the browser bundle.
 */
export const adminConfig: ClientAppConfig = resolveClientConfig({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || undefined,
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV as AppEnvironment) || undefined,
  audience: 'ADMIN_WEB',
});
