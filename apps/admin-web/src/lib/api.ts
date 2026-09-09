import { createApiClient, type ApiClient } from '@platform/api-client';
import { adminConfig } from './config';

/**
 * Shared ApiClient instance configured for TorangGo Admin Web.
 * Base URL comes strictly from client configuration without hardcoded hosts or ports.
 *
 * Phase 1G Auth Readiness:
 * When session/token handling is implemented in Phase 1G, auth headers or interceptors
 * will be injected through this client foundation.
 */
export const adminApiClient: ApiClient = createApiClient({
  baseUrl: adminConfig.apiBaseUrl,
});
