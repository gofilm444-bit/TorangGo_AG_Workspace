import { createApiClient, type ApiClient } from '@platform/api-client';
import { driverConfig } from './config';

/**
 * Shared ApiClient instance configured for Driver Mobile app.
 * Base URL comes strictly from client configuration without hardcoded IPs or ports.
 */
export const driverApiClient: ApiClient = createApiClient({
  baseUrl: driverConfig.apiBaseUrl,
});
