import { resolveClientConfig, type ClientAppConfig } from '@platform/config';

/**
 * Client-safe configuration for TorangGo Admin Web.
 *
 * NEVER expose backend database URLs, Redis credentials, service keys,
 * or signing secrets here.
 * Base URL and environment are safely resolved from environment variables
 * or fallbacks via @platform/config.
 */
export const adminConfig: ClientAppConfig = resolveClientConfig({
  audience: 'ADMIN_WEB',
});
